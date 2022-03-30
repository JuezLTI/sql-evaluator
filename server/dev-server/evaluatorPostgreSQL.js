import { loadSchemaPEARL, EvaluationReport } from "evaluation-report-juezlti"
import "babel-polyfill"
import { env } from "process"
const { Pool, Client } = require('pg')

var nameAndPassword = ''
var globalProrammingExercise = {}

async function evalSQLPostgreSQL(programmingExercise, evalReq) {
    return new Promise((resolve) => {
        globalProrammingExercise = programmingExercise
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
            response.report.exercise = programmingExercise.id
            response.report.compilationErrors = []
            try {

                let solution_id = ""
                for (let solutions of programmingExercise.solutions) {
                    if (solutions.lang == "sql") {
                        solution_id = solutions.id
                        break
                    }
                }
                const solution = programmingExercise.solutions_contents[solution_id]
                let correct_anwsers = true
                for (let metadata of programmingExercise.tests) {
                    let input = programmingExercise.tests_contents_in[metadata.id]

                    var teacherResult = getQueryResult(
                        solution
                    )
                    var studentResult = getQueryResult(
                        program
                    )
                    if (teacherResult != studentResult) {
                        correct_anwsers = false
                        response.report.compilationErrors.push("incorrect sql solution")
                    }
                }
                evalRes.setReply(response)
                resolve(evalRes)

            } catch (error) {
                response.report.compilationErrors.push(error)
                evalRes.setReply(response)
                resolve(evalRes)
            }
        })
    })
}

const getConnection = (dbUser = null, dbPassword = null, dbName = null) => {
    let dbms = getQuestionDbms()

    dbUser = dbUser ? dbUser : env('SQL_EVALUATOR_USER')
    dbPassword = dbPassword ? dbPassword : env('SQL_EVALUATOR_PASSWORD')
    dbName = dbName ? dbName : env('SQL_EVALUATOR_DATABASE')
    let connectionParameters = {
        user: dbUser,
        host: env('SQL_EVALUATOR_HOST'),
        database: dbName,
        password: dbPassword,
        port: env('SQL_EVALUATOR_PORT'),
      }
      console.log(connectionParameters)
    const connection = new Pool(connectionParameters)

    return connection
}

// TODO code preGrade with MUST and MUSN'T

const getQueryResult = (queries = null)  => {
    connection = initTransaction()
    connection.query('queries', (err, res) => {
        console.log(err, res)
        connection.end()
      })
    // TODO execute solution's queries
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

    if (getQuestionType() == 'DML' || getQuestionType() == 'DDL') {
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
    resultQueryArray = resultQuery ? resultQuery.fetchAll() : array()
    resultQuery = null
    endTransaction(connection)
    return resultQueryArray
}

const isRoutine = (query)  => {
    // TODO define when a query is a routine
    return false
}

const isQuery = (query)  => {
    return strlen(trim(query)) > 1
}

const createOnflySchema = (connection)  => {
    let dbms = getQuestionDbms()
    nameAndPassword = env('SQL_EVALUATOR_USERPREFIX') + getNameAndPasswordSuffix()

    createUserSentence =
        "CALL " + env('CREATEISOLATEUSERPROCEDURE') + "('"
        + nameAndPassword + "', '"
        + nameAndPassword
        + "')"
    if (resultQuery = connection.prepare(createUserSentence)) {
        resultQuery.execute()
    }
    databaseName = nameAndPassword
    connection = getConnection(nameAndPassword, nameAndPassword, databaseName)

    connection.exec(this.getQuestionOnfly())
    return connection
}

const dropOnflySchema = (connection) => {
    let dbms = getQuestionDbms()
    nameAndPassword = env('SQL_EVALUATOR_USERPREFIX') + getNameAndPasswordSuffix()
    dropUserSentence =
        "CALL " + onFly['dropIsolateUserProcedure'] + "('"
        + nameAndPassword
        + "')"

    if(resultQuery = connection.prepare(dropUserSentence)) {
        resultQuery.execute()
    }
}

const getNameAndPasswordSuffix = () => {
    if(nameAndPassword == '') {
        const crypto = require('crypto');
        const buf = crypto.randomBytes(16);
        nameAndPassword = buf.toString('utf8');
    }
    return nameAndPassword
}

const initTransaction = () => {
    connection = getConnection()
    connection = createOnflySchema(connection)
    connection.beginTransaction()
    return connection
}

const endTransaction = (connection) => {
    connection.rollback()
    // Close statement & connection to drop user
    connection = null
    connection = getConnection()
    connection = dropOnflySchema(connection)
    return connection
}

const sanitize = (stmt) => {
    sanitizedStmt = str_replace("'", "''", trim(stmt))
    return sanitizedStmt
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
