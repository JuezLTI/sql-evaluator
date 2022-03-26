const chai = require('chai'),
    expect = chai.expect;
const path = require('path');
const uuid = require('uuid');
const randomstring = require("randomstring");
const { loadSchemaYAPEXIL, ProgrammingExercise } = require('programming-exercise-juezlti')

describe('Test for ProgrammingExercise', function() {
    this.timeout(10000);
    const email = "info@juezlti.eu";
    const password = "Ju3zLT1.";
    before(async function() {

        await loadSchemaYAPEXIL();
    });

    it('Test metadata of an exercise fetched using authokit-api ', async function() {

        let exerciseObj = await ProgrammingExercise.loadRemoteExerciseAuthorkit(`e75ab89a-b03b-4876-8e5b-dcb2e1dd0cf7`, email, password)
        expect(ProgrammingExercise.isValid(exerciseObj)).to.equal(true);

    })

    it('Test deserialization and serialization ', async function() {

        let exerciseObj = await ProgrammingExercise.loadRemoteExerciseAuthorkit(`e75ab89a-b03b-4876-8e5b-dcb2e1dd0cf7`, email, password)
        await exerciseObj.serialize(path.join(__dirname, 'resources'));
        let exerciseObj2 = await ProgrammingExercise.deserialize(path.join(__dirname, 'resources'), "e75ab89a-b03b-4876-8e5b-dcb2e1dd0cf7.zip")
        expect(ProgrammingExercise.isValid(exerciseObj2)).to.equal(true);
    })



    it('Test setID', function() {
        let exerciseObj = new ProgrammingExercise()
        expect(exerciseObj.setId(uuid.v4())).to.equal(true)
    })

    it('Test setTitle', function() {
        let exerciseObj = new ProgrammingExercise()
        expect(exerciseObj.setTitle(
            randomstring.generate({
                length: Math.random() * (100),
                charset: 'alphabetic'
            })
        )).to.equal(true)
    })
    it('Test setAuthor', function() {
        let exerciseObj = new ProgrammingExercise()
        expect(exerciseObj.setAuthor(
            randomstring.generate({
                length: Math.random() * (100),
                charset: 'alphabetic'
            })
        )).to.equal(true)
    })
    it('Test setKeywords', function() {
        let exerciseObj = new ProgrammingExercise()
        let list = []
        for (let i in (Math.random() * 20)) {
            list.push(

                randomstring.generate({
                    length: Math.random() * (100),
                    charset: 'alphabetic'
                })
            )
        }
        expect(exerciseObj.setKeywords(list)).to.equal(true)
    })

    it('Test setStatus', function() {
        let exerciseObj = new ProgrammingExercise()
        let list = [
            "DRAFT",
            "PUBLISHED",
            "UNPUBLISHED",
            "TRASH"
        ]
        expect(exerciseObj.setStatus(
            list[
                Math.round(Math.random() * (3))
            ]
        )).to.equal(true)
    })

    it('Test setType', function() {
        let exerciseObj = new ProgrammingExercise()
        let list = [
            "BLANK_SHEET",
            "EXTENSION",
            "IMPROVEMENT",
            "BUG_FIX",
            "FILL_IN_GAPS",
            "SORT_BLOCKS",
            "SPOT_BUG"
        ]
        expect(exerciseObj.setType(
            list[
                Math.round(Math.random() * (6))
            ]
        )).to.equal(true)
    })
    it('Test setTest', function() {
        let exerciseObj = new ProgrammingExercise()

        expect(exerciseObj.setTests(
            [{
                id: '00000000-0000-0000-0000-000000000000',
                arguments: [],
                weight: 5,
                visible: true,
                input: 'input1.txt',
                output: 'output1.txt'
            }]
        )).to.equal(true)
    })

    it('Test setStatements', function() {
        let exerciseObj = new ProgrammingExercise()

        expect(exerciseObj.setStatements(
            [{
                id: '00000000-0000-0000-0000-000000000000',
                pathname: 'statements.html',
                nat_lang: 'en',
                format: 'HTML'
            }, ]
        )).to.equal(true)
    })
    it('Test setSolutions', function() {
        let exerciseObj = new ProgrammingExercise()

        expect(exerciseObj.setSolutions(
            [{
                id: '00000000-0000-0000-0000-000000000000',
                pathname: 'solution.cpp',
                lang: 'cpp'
            }]
        )).to.equal(true)
    })




})