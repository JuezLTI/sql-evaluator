import { loadSchemaPEARL, EvaluationReport } from "evaluation-report-juezlti"
import "babel-polyfill"
import { env } from "process"
import { resolve } from "path"
import convertOutput from "./convertOutput";
const { Pool, Client } = require('pg')

const LANGUAGE = 'pgsql'
const DML = 'SQL-DML'
const DDL = 'SQL-DDL'
var nameAndPassword = ''
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
                }

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
                    if (solutions.lang == LANGUAGE) {
                        solution_id = solutions.id
                        break
                    }
                }
                const solution = programmingExercise.solutions_contents[solution_id]
                for (let metadata of programmingExercise.tests) {
                    let lastTestError = {}

                    let input = programmingExercise.tests_contents_in[metadata.id]

                    // let expectedOutput = programmingExercise.tests_contents_out[metadata.id]

                    let expectedOutput = await getQueryResult(
                        solution
                    )
                    let resultStudent = await getQueryResult(
                        program
                    )
                    .catch(error => {
                        lastTestError = error
                    })
                    let expectedRows = getRowsFromResult(expectedOutput)
                    let studentRows = getRowsFromResult(resultStudent)
                    if(getGrade(expectedRows, studentRows) == 0) {
                        summary = {
                            "classify" : 'Wrong Answer',
                            "feedback" : 'Try it again'
                        }
                    }
                    tests.push(addTest(input, expectedRows, studentRows, lastTestError))
                }

            } catch (error) {
                console.log(error)
                let summary = {
                    "classify" : "Compile Time Error",
                    "feedback" : error.message
                }
                evalRes.summary = summary
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

const getQueryResult = (queries = null) => {
    return new Promise((resolve, reject) => {
        initTransaction()
            .then((connection) => {
                let questionType = getQuestionType()
                if (questionType.includes(DML) || questionType.includes(DDL)) {
                    queries += ';\n' + getQuestionProbe()
                }
                connection.query(queries)
                .then((resultQuery) => {
                    endTransaction(connection)
                    .then(() => {
                        resolve(resultQuery)
                    })
                    .catch(error => { // error in rollback
                        console.log(error)
                        reject(error)
                    })
                })
                .catch(error => { // wrong sql solution or test statements
                    console.log(error)
                    reject(error)
                })
            })
            .catch(error => { // wrong onFly schema
                console.log(error)
                reject(error)
            })
    })
}

const createOnflySchema = (connection) => {
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
                            if (error) reject(error)
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
            // Close statement & connection to drop user
            connection.end()
            if (error) reject(error)
            getConnection()
                .then(connection => {
                    dropOnflySchema(connection)
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
    })
}

const addTest = (input, expectedOutput, obtainedOutput, lastTestError) => {
    expectedOutput = expectedOutput ? expectedOutput : ''
    // expectedOutput = convertOutput.table2json(expectedOutput)
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

const getClassify = (expectedOutput, obtainedOutput, lastTestError) => {
    let classify = 'Accepted'
    console.log('lastTestError: ' + JSON.stringify(lastTestError))
    if (getGrade(expectedOutput, obtainedOutput) < 1)
        classify = 'Wrong Answer'
    if (lastTestError?.code) {
        switch (lastTestError.code) {
            case 143:
                classify = 'Time Limit Exceeded'
                break
            default:
                classify = 'Runtime Error'
        }
    }
    return classify
}

const getQuestionType = () => {
    return globalProgrammingExercise.programmingLanguages
}

const getQuestionProbe = () => {
    let metadata = globalProgrammingExercise.tests
    let queriesProbe = globalProgrammingExercise.tests_contents_in[metadata[0].id]
    return queriesProbe
}

module.exports = {
    evalSQLPostgreSQL
}
