import { loadSchemaPEARL, EvaluationReport } from "evaluation-report-juezlti"
import "babel-polyfill"
import convertOutput from "./convertOutput";

const { Pool, Client } = require('pg')

const LANGUAGE = 'SQL'
const STATEMENT_TIMEOUT = 2000
const MAX_RESULT_ROWS = 1000

var globalProgrammingExercise = {}

async function evalSQLPostgreSQL(programmingExercise, evalReq) {
    return new Promise((resolve) => {
        globalProgrammingExercise = programmingExercise
        loadSchemaPEARL().then(async () => {
            var evalRes = new EvaluationReport(),
                response = {},
                summary = {
                    "classify" : 'Accepted',
                    "feedback" : 'Well done'
                },
                compilationError = false

            evalRes.setRequest(evalReq.request)
            let program = evalReq.request.program
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
                    if (solutions.lang.toUpperCase().includes( LANGUAGE )) {
                        solution_id = solutions.id
                        break
                    }
                }
                const solution = programmingExercise.solutions_contents[solution_id]
                for (let metadata of programmingExercise.tests) {

                    let input = programmingExercise.tests_contents_in[metadata.id]

                    // let expectedOutput = programmingExercise.tests_contents_out[metadata.id]

                    let expectedOutput = await getQueryResult(
                        solution, input
                    )
                    let resultStudent = await getQueryResult(
                        program, input
                    )
                    .catch(error => {
                        summary = {
                            "classify" : "Compile Time Error",
                            "feedback" : error.message
                        }
                        compilationError = true
                    })
                    if(!compilationError) {
                        let expectedRows = getRowsFromResult(expectedOutput)
                        let studentRows = getRowsFromResult(resultStudent)
                        if(getGrade(expectedRows, studentRows) == 0) {
                            summary = {
                                "classify" : 'Wrong Answer',
                                "feedback" : 'Try it again'
                            }
                        }
                        tests.push(addTest(input, expectedRows, studentRows, metadata))
                    }
                }

            } catch (error) {
                summary = {
                    "classify" : "Compile Time Error",
                    "feedback" : error.message
                }
            } finally {
                response.report.tests = tests
                evalRes.setReply(response)
                evalRes.summary = summary
                resolve(evalRes)
            }
        })
    })
}

const getRowsFromResult = (obtainedOutput) => {
    let rows = []
    if(Array.isArray(obtainedOutput)) {
        rows = obtainedOutput[obtainedOutput.length - 1].rows
    } else {
        rows = obtainedOutput ? obtainedOutput.rows : []
    }
    return rows
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
            // max: 20,
            // idleTimeoutMillis: 1000,
            // connectionTimeoutMillis: 15000,
            statement_timeout: STATEMENT_TIMEOUT
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

const getQueryResult = (queries = null, inputTest) => {
    return new Promise((resolve, reject) => {
        initTransaction()
            .then((connection) => {
                let questionType = getQuestionType()
                connection.query(queries)
                .then(async (resultQuerySolution) => {
                    if(resultQuerySolution?.rowCount > MAX_RESULT_ROWS) {
                        reject(new Error('Too long result'))
                    }
                    executeInputTest(connection, inputTest)
                    .then((resultQueryInput) => {
                         // (questionType.includes(DML) || questionType.includes(DDL))
                        let resultQuery = resultQueryInput.constructor.name == 'Result' // When exists at least one SELECT into test IN.
                            ? resultQueryInput
                            : resultQuerySolution
                        endTransaction(connection)
                        .catch(error => { // error in rollback
                            console.log(error)
                            reject(error)
                        })
                        resolve(resultQuery)
                    })
                })
                .catch(error => { // wrong sql solution or test statements
                    console.log(error)
                    endTransaction(connection)
                    .then(() => {
                        reject(error)
                    })
                    .catch(error => { // error in rollback
                        console.log(error)
                        reject(error)
                    })
                })
                .finally(() => {
                })
            })
            .catch(error => { // wrong onFly schema
                console.log(error)
                reject(error)
            })
    })
}

const executeInputTest = (connection, inputTest) => {
    return new Promise((resolve, reject) => {
        let executedQueries = []
        let resultQuery = {}
        inputTest.trim().split(';').forEach(inputQuery => {
            executedQueries.push(connection.query(inputQuery))
        });
        Promise.allSettled(executedQueries)
        .then((resultQueries) => {
            if(Array.isArray(resultQueries)) {
                let selectFound = false
                let index = resultQueries.length
                while(!selectFound && --index >= 0) {
                    if(resultQueries[index]?.value?.command?.toUpperCase() == 'SELECT') {
                        selectFound = true
                        resultQuery = resultQueries[index].value
                    }
                }
            }
            resolve(resultQuery) // return last SELECT execution 
        })
    })
}

const createOnflySchema = (connection) => {
    return new Promise((resolve, reject) => {
        //    let dbms = getQuestionDbms()
        var nameAndPassword = process.env.SQL_EVALUATOR_USERPREFIX + getNameAndPasswordSuffix()

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
                        for (let library of globalProgrammingExercise.libraries) {
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

const dropOnflySchema = (connection, userConnection) => {
    return new Promise((resolve, reject) => {
        // let dbms = getQuestionDbms()
        let dropUserSentence =
            "CALL " + process.env.DROPISOLATEUSERPROCEDURE + "('"
            + userConnection
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
                        resolve(connection)
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
        var userConnection = connection.user
        // Close statement & connection to drop user
        connection.end()
        getConnection()
            .then(connection => {
                dropOnflySchema(connection, userConnection)
                    .then(res => {
                        connection.end
                        resolve()
                    })
                    .catch(error => {
                        reject(error)
                    })
            })
            .catch(error => {
                reject(error)
            })
    })
}

const addTest = (input, expectedOutput, obtainedOutput, metadata) => {
    expectedOutput = expectedOutput ? expectedOutput : ''
    // expectedOutput = convertOutput.table2json(expectedOutput)
    obtainedOutput = obtainedOutput ? obtainedOutput : ''
    return {
        'input': input,
        'expectedOutput': convertOutput.json2table(expectedOutput),
        'obtainedOutput': convertOutput.json2table(obtainedOutput),
        'outputDifferences': getOutputDifferences(expectedOutput, obtainedOutput),
        'classify': getClassify(expectedOutput, obtainedOutput),
        'mark': getGrade(expectedOutput, obtainedOutput),
        'visible': metadata.visible,
        'hint': metadata.feedback,
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
    const outputDifferences = Diff.diffArrays(expectedOutput, obtainedOutput, { comparator: comparator })

    return outputDifferences;
}

const getFeedback = (expectedOutput, obtainedOutput) => {
    let feedback = 'Right Answer.'
    // TODO get feedback from exercise's test

    if (getGrade(expectedOutput, obtainedOutput) < 1)
        feedback = 'Wrong Answer.'

    return feedback
}

const getClassify = (expectedOutput, obtainedOutput) => {
    let classify = 'Accepted'
    if (getGrade(expectedOutput, obtainedOutput) < 1)
        classify = 'Wrong Answer'
    return classify
}

const getQuestionType = () => {
    const questionTypes = globalProgrammingExercise.programmingLanguages.map(questionType => {
        return questionType.toUpperCase()
    })
    return questionTypes;

}

module.exports = {
    evalSQLPostgreSQL
}
