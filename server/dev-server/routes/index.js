import express from "express";
import { loadSchemaYAPEXIL, ProgrammingExercise } from "programming-exercise-juezlti";
import { loadSchemaPEARL, EvaluationReport } from "evaluation-report-juezlti";
import dotenv from 'dotenv'
dotenv.config('../env.js');
import evaluatorPostgreSQL from "../evaluatorPostgreSQL";
import path from "path";
import request from "request";

import fs from "fs";

var router = express.Router();

router.get("/capabilities", function(req, res, next) {
    let evalRes = new EvaluationReport();
    let obj = {
        capabilities: [{
            id: "SQL-DQL",
            features: [{
                    name: "language",
                    value: "sql-dql",
                },
                {
                    name: "version",
                    value: ".01",
                },
                {
                    name: "engine",
                    value: "https://www.postgresql.org/",
                },
            ],
        },{
            id: "SQL-DML",
            features: [{
                    name: "language",
                    value: "sql-dml",
                },
                {
                    name: "version",
                    value: ".01",
                },
                {
                    name: "engine",
                    value: "https://www.postgresql.org/",
                },
            ],
        },{
            id: "SQL-DDL",
            features: [{
                    name: "language",
                    value: "sql-ddl",
                },
                {
                    name: "version",
                    value: ".01",
                },
                {
                    name: "engine",
                    value: "https://www.postgresql.org/",
                },
            ],
        }, ],
    };

    evalRes.setReply(obj);
    res.send(evalRes);
});

router.get("/", function(req, res) {
    let text = fs.readFileSync(
        path.join(__dirname, "../../public/doc/intro.txt"), { encoding: "utf8", flag: "r" }
    );
    let curl_exm = fs.readFileSync(
        path.join(__dirname, "../../public/doc/curl"), { encoding: "utf8", flag: "r" }
    );

    try {
        res.render("index");
    } catch (e) {
        console.log(e);
    }
});

router.post("/eval", function(req, res, next) {

    loadSchemaPEARL().then(() => {

        let evalReq = new EvaluationReport();
        if (evalReq.setRequest(req.body)) {
            if ("program" in evalReq.request) {
                loadSchemaYAPEXIL().then(() => {
                    ProgrammingExercise.deserialize(path.join(__dirname, "../../public/zip"), `${evalReq.request.learningObject}.zip`).
                        then((programmingExercise) => {
                            evaluate(programmingExercise, evalReq, req, res, next)
                    }).catch((error) => {
                            ProgrammingExercise
                                .loadRemoteExercise(evalReq.request.learningObject, {
                                    'BASE_URL': process.env.BASE_URL,
                                    'EMAIL': process.env.EMAIL,
                                    'PASSWORD': process.env.PASSWORD,
                                })
                                .then((programmingExercise) => {

                                    evaluate(programmingExercise, evalReq, req, res, next)

                                    programmingExercise
                                        .serialize(path.join(__dirname, "../../public/zip"))
                                        .then((test) => {
                                            if (test) {
                                                console.log(
                                                    `The exercise ${programmingExercise.id} was insert in cache`
                                                );
                                            }
                                        });
                                }).catch((error) => {
                                    console.log(error)
                                    console.log(" 1º error LearningObj not found or could not be loaded");
                                    res.send({ error: "LearningObj not found" });
                                });
                            })
                    })
            }
        } else {
            res.send({ "error": "INVALID PEARL" }).status(500);
        }

    })
});

function evaluate(programmingExercise, evalReq, req, res, next) {
    evaluatorPostgreSQL.evalSQLPostgreSQL(programmingExercise, evalReq).then((obj) => {
       console.log("Answer ->" + JSON.stringify(obj))
       req.sql_eval_result = obj;

        next();
    });
}

router.post("/eval", function(req, res, next) {
    request({
            method: "POST",
            url: process.env.FEEDBACK_MANAGER_URL,
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(req.sql_eval_result)
        },
        function(error, response) {

            if (error!=null || response.statusCode != 200){
                console.log(error)
                res.json(error).status(500);
            }
            else {
                let pearlWithFeedback = JSON.parse(response.body)
                res.json(pearlWithFeedback);
            } 
        }
    );
});

export { router };
