import { loadSchemaPEARL, EvaluationReport } from "evaluation-report-juezlti"
import "babel-polyfill"
import { env } from "process"
import { resolve } from "path"
import convertOutput from "./convertOutput";
const { Pool, Client } = require('pg')

const LANGUAGE = 'pgsql'
var nameAndPassword = ''
var globalProgrammingExercise = {}

async function evalSQLPostgreSQL(programmingExercise, evalReq) {
    return new Promise((resolve) => {
        globalProgrammingExercise = programmingExercise
        loadSchemaPEARL().then(async () => {
            let evalRes = new EvaluationReport()
            evalRes.setRequest(evalReq.request)
            let program = evalReq.request.program
            let response = {}
            response.report = {}
            response.report.capability = {
                "id": "SQL-evaluator",
                "features": [{
                    "name": "language",
                    "value": "SQL"
                }, {
                    "name": "version",
                    "value": "Postgres 14"
                }, {
                    "name": "engine",
                    "value": "https://www.postgresql.org/"
                }]
            }
            response.report.programmingLanguage = LANGUAGE
            response.report.exercise = programmingExercise.id
            let tests = []
            try {
                let solution_id = ""
                for (let solutions of programmingExercise.solutions) {
                    if (solutions.lang == LANGUAGE) {
                        solution_id = solutions.id
                        break
                    }
                }
                const solution = programmingExercise.solutions_contents[solution_id]
                for (let metadata of programmingExercise.tests) {
                    let lastTestError = {}

                    let input = programmingExercise.tests_contents_in[metadata.id]

                    let expectedOutput = programmingExercise.tests_contents_out[metadata.id]

                    /* var expectedOutput = await getQueryResult(
                        solution
                    ) */
                    var resultStudent = await getQueryResult(
                        program
                    )
                    .catch(error => {
                        lastTestError = error
                    })
                    console.log(resultStudent.rows)
                    tests.push(addTest(input, expectedOutput, resultStudent.rows, lastTestError))
                }

            } catch (error) {
                console.log(error)
            } finally {
                response.report.tests = tests
                evalRes.setReply(response)
                resolve(evalRes)
            }
        })
    })
}

const getConnection = (dbUser = null, dbPassword = null, dbName = null) => {
//    let dbms = getQuestionDbms()
    return new Promise((resolve, reject) => {
        dbUser = dbUser ? dbUser : process.env.SQL_EVALUATOR_USER
        dbPassword = dbPassword ? dbPassword : process.env.SQL_EVALUATOR_PASSWORD
        dbName = dbName ? dbName : process.env.SQL_EVALUATOR_DATABASE

        let connectionParameters = {
            user: dbUser.toLowerCase(),
            host: process.env.SQL_EVALUATOR_HOST,
            database: dbName.toLowerCase(),
            password: dbPassword,
            port: process.env.SQL_EVALUATOR_PORT,
        }

        const pool = new Pool(connectionParameters)

        pool.connect()
        .then(connectionPostgreSQL => {
            resolve(connectionPostgreSQL)
        })
        .catch(error => {
            console.log(error)
            reject(error)
        })
    })
}

// TODO code preGrade with MUST and MUSN'T

const getQueryResult = (queries = null)  => {
return new Promise((resolve, reject) => {
    initTransaction()
    .then((connection) => {
        connection.query(queries, (err, resultQuery) => {
            if(err) reject(err)
            // TODO execute solution's queries DML and DDL
        /*     if(isRoutine(queries)) {
                query = substr(rtrim(queries), 0, strlen(rtrim(queries)) - 1)
                query = str_replace("'", "''", query)
                if (resultQuery = connection.prepare(query)) {
                    resultQuery.execute()
                }
            } else {
                explode(";", queries).foreach(query => {
                    if(isQuery(query) && (resultQuery = connection.prepare(query))) {
                        resultQuery.execute()
                    }
                })
            } */

    /*         if (getQuestionType() == 'DML' || getQuestionType() == 'DDL') {
                explode(";", getQuestionProbe()).foreach(query => {
                    if(isQuery(query) && (resultQuery = connection.prepare(query))) {
                        resultQuery.execute()
                        if(connection.errorInfo()[1] > 0 ) { 
                            queryProbe =
                                " BEGIN " + query + "; END;"
                            if (resultQuery = connection.prepare(queryProbe)) {
                                resultQuery.execute()
                            }

                        }
                    }
                })
                // We only watch the result of the last query. The last query will often be a SELECT query
            }
            */
            // resultQueryArray = resultQuery ? resultQuery.fetchAll() : array()
            // resultQuery = null
            endTransaction(connection)
            .then(connection => {
                connection.end()
                resolve(resultQuery)
            })
            .catch(error => {
                reject(error)
            })
        })
    })
    .catch(error => {
        console.log(error)
    })

})
}

const createOnflySchema = (connection)  => {
    return new Promise((resolve, reject) => {
        //    let dbms = getQuestionDbms()
        nameAndPassword = process.env.SQL_EVALUATOR_USERPREFIX + getNameAndPasswordSuffix()

        const createUserSentence =
            "CALL " + process.env.CREATEISOLATEUSERPROCEDURE + "('"
            + nameAndPassword + "', '"
            + nameAndPassword
            + "')"
        connection
        .query(createUserSentence)
        .then(res => {
            connection.end()
            let databaseName = nameAndPassword
            getConnection(nameAndPassword, nameAndPassword, databaseName)
            .then(connection => {
                let onFlyPromises = []
                for(let library of globalProgrammingExercise.libraries) {
                    let onFlyQuery = globalProgrammingExercise.libraries_contents[library.id]
                    onFlyPromises.push(connection.query(onFlyQuery))
                }
                Promise.all(onFlyPromises)
                .then(onFlyResults => {
                    resolve(connection)
                })
                .catch(error => {
                    reject(error)
                })
            })

        })
        .catch(e => reject(e))
    })
}

const dropOnflySchema = (connection) => {
    return new Promise((resolve, reject) => {
        // let dbms = getQuestionDbms()
        let dropUserSentence =
            "CALL " + process.env.DROPISOLATEUSERPROCEDURE + "('"
            + nameAndPassword
            + "')"
            connection
            .query(dropUserSentence)
            .then(res => {
                resolve(res)
            })
            .catch(e => reject(e))
    })
}

const getNameAndPasswordSuffix = () => {
    const crypto = require('crypto')
    return crypto.randomUUID().replace(/-/g, "")
}

const initTransaction = () => {
    return new Promise((resolve, reject) => {
        getConnection()
            .then(connection => {
                createOnflySchema(connection)
                .then(connection => {
                    connection.query('BEGIN', error => {
                        if(error) reject(error)
                        resolve(connection)
                    })
                })
                .catch(error => {
                    console.log(error)
                    reject(error)
                })
            })
            .catch(error => {
                console.log(error)
                reject(error)
            })
    })
}

const endTransaction = (connection) => {
    return new Promise((resolve, reject) => {
        connection.query('ROLLBACK', error => {
            if(error) reject(error)
            // Close statement & connection to drop user
            connection.end()
            getConnection()
            .then(connection => {
                dropOnflySchema(connection)
                .then(res => {resolve(connection)})
                .catch(error => {
                    reject(error)
                })
            })
            .catch(error => {
                reject(error)
            })
        })
    })
}

const addTest = (input, expectedOutput, obtainedOutput, lastTestError) => {
    expectedOutput = convertOutput.table2json(expectedOutput)
    obtainedOutput = obtainedOutput ? obtainedOutput : ''
    return {
        'input': input,
        'expectedOutput': convertOutput.json2table(expectedOutput),
        'obtainedOutput': convertOutput.json2table(obtainedOutput),
        'outputDifferences': getOutputDifferences(expectedOutput, obtainedOutput),
        'classify': getClassify(expectedOutput, obtainedOutput, lastTestError),
        'mark': getGrade(expectedOutput, obtainedOutput),
        'feedback': getFeedback(expectedOutput, obtainedOutput),
        'environmentValues': []
    }
}

const getGrade = (expectedOutput, obtainedOutput) => {
    return JSON.stringify(expectedOutput) == JSON.stringify(obtainedOutput) ? 100 : 0
}

const getOutputDifferences = (expectedOutput, obtainedOutput) => {
    const Diff = require('diff')
    // if expectedOutput come as a HTML table
    function comparator(expectedRow, obtainedRow) {
        return JSON.stringify(expectedRow) == JSON.stringify(obtainedRow)
    }
    const outputDifferences = Diff.diffArrays(expectedOutput, obtainedOutput, {comparator: comparator})

    return outputDifferences;
}

const getFeedback = (expectedOutput, obtainedOutput) => {
    let feedback = 'Right Answer.'
    // TODO get feedback from exercise's test

    if(getGrade(expectedOutput, obtainedOutput) < 1)
        feedback = 'Wrong Answer.'

    return feedback
}

const getClassify = (expectedOutput, obtainedOutput, lastTestError) => {
    let classify = 'Accepted'
console.log('lastTestError: ' + JSON.stringify(lastTestError))
    if(getGrade(expectedOutput, obtainedOutput) < 1)
        classify = 'Wrong Answer'
    if(lastTestError?.code) {
        switch(lastTestError.code) {
            case 143:
                classify = 'Time Limit Exceeded'
                break
            default:
                classify = 'Runtime Error'
        }
    }
    return classify
}


const getQueryTable = () => {
    resultQueryString = ''
    if (getQuestionType() == 'SELECT') {
        let connection = initTransaction()
        resultQueryString = "<div class='table-results'><table>"
        query = getQuestionSolution()
        if(resultQuery = connection.prepare(query)) {
            resultQuery.execute()
            resultQueryString += getQueryTableContent(resultQuery)
            resultQueryString += "</table></div>"
        }
        resultQuery = null
        connection = endTransaction(connection)
    }
    return resultQueryString
}

const getQueryTableContent = (resultQuery) => {
    resultQueryString = ''
    if (is_array(firstRow = resultQuery.fetch())) { // \PDO::FETCH_ASSOC
        resultQueryString += getHeaderQueryTable(firstRow)
        resultQueryString += getBodyQueryTable(firstRow, resultQuery)
    }
    return resultQueryString
}

const getHeaderQueryTable = (firstRow) => {
    columnNames = array_keys(firstRow)
    return getQueryTableRow(columnNames, true)
}

const getBodyQueryTable = (firstRow, resultQuery) => {
    tableBody = getQueryTableRow(array_values(firstRow), false)
    while (row = resultQuery.fetch()) { // \PDO::FETCH_NUM
        tableBody += getQueryTableRow(row, false)
    }
    return tableBody
}

const getQueryTableRow = (row, header = false) => {
    tableRow = "<tr>"
    row.foreach (value => {
        tableRow += ( header ? "<th>" : "<td>") + value + ( header ? "</th>" : "</td>")
    })
    tableRow += "</tr>"
    return tableRow
}

module.exports = {
    evalSQLPostgreSQL
}
