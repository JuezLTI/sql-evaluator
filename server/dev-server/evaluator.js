import { loadSchemaPEARL, EvaluationReport } from "evaluation-report-juezlti"
import "babel-polyfill"
import { resolve } from "path"

async function evalSQL(programmingExercise, evalReq) {
    return new Promise((resolve) => {
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
                    "value": "Postgres"
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
/*                 for (let metadata of programmingExercise.tests) {
                    let input = programmingExercise.tests_contents_in[metadata.id]

                    var teacherResult = getOutputFromCode(
                        files[0],
                        input
                    )
                    var studentResult = getOutputFromCode(
                        files[1],
                        input
                    )
                    let [teacherNode, studentNode] = await Promise.all([teacherResult, studentResult])
                    if (teacherNode != studentNode) {
                        correct_anwsers = false
                        response.report.compilationErrors.push("incorrect sql solution")
                    }
                } */
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


const getOutputFromCode = (info, input) => {
    return new Promise((resolve, reject) => {
        var util = require('util'),
            execFile = require('child_process').execFile,
            output = ''
        const child = execFile('java', ['-Duser.language=es', '-Duser.region=ES', info.path],
            {
                timeout: 5000,
                maxBuffer: 65535
            })

        child.stdin.setEncoding = 'utf-8'

        child.stdout.on('data', (data) => {
            output += data.toString()
        })

        // Handle error output
        child.stderr.on('data', (data) => {
            reject(data)
        })
        child.stdout.on('end', async function (code) {
            resolve(output)
        })

        process.stdin.pipe(child.stdin)
        child.stdin.write(input + '\n')
    })
}


module.exports = {
    evalSQL
}
