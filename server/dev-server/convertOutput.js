'use strict';

const tabletojson = require('tabletojson').Tabletojson;
const json2html = require('node-json2html')

const table2json = outputTable => {
    const jsonFromTable = tabletojson.convert(outputTable);
    return jsonFromTable[0]
}

const json2table = outputJson => {
    let table = '<table>'
    let template = { "tag": "tr" }
    let firstRow = outputJson[0]
    if (firstRow) {
        template.children = getTemplateHeader(firstRow)
        table += json2html.render(firstRow, template);
        template.children = getTemplateRowBody(outputJson)
        table += json2html.render(outputJson, template);
    }
    table += '</table>'
    return table
}

const getTemplateHeader = firstRow => {
    let theadRowTemplate = []
    Object.keys(firstRow).forEach(function (key) {
        theadRowTemplate.push({
            "tag": "th",
            "html": key
        })
    });
    return theadRowTemplate
}

const getTemplateRowBody = outputJson => {
    let tbodyRowTemplate = []
    let firstRow = outputJson[0]
    if (firstRow) {
        Object.keys(firstRow).forEach(function (key) {
            tbodyRowTemplate.push({
                "tag": "td",
                "html": "${" + key + "}"
            })
        });
    }
    return tbodyRowTemplate
}

export default {
    table2json,
    json2table
}