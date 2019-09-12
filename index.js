"use strict";
const https = require("https");
const url = require("url");
const fs = require("fs");
const load = require('load-json-file').sync;
const config = load("config.json");

const bunyan = require("bunyan");
var log = bunyan.createLogger({name: "gdut"})

function output() { 
	const data = load(config.data_file);
	var ret = '"学号","姓名","品德表现评价","不及格科目数","平均绩点","学业成绩","创新实践","社会实践","文体实践","综合测评总分"';
	ret += "\r\n";
	for (var id in data.info) { 
		const line_data = [
			"'" + id,
			data.info[id].name,
			data.info[id].morals,
			data.info[id].fail_count,
			data.info[id].points,
			data.info[id].score,
			data.info[id].creative,
			data.info[id].social,
			data.info[id].arts,
			data.info[id].score * 0.7 + data.info[id].creative * 0.15 + data.info[id].social * 0.1 + data.info[id].arts * 0.05
		];
		const linetext = "\"" + line_data.join("\",\"") + "\"\r\n";
		ret += linetext; 
	}
	return ret;
}
const headers = {
	"Access-Control-Allow-origin": "*",
	"Content-Type": "text/event-stream",
	"Cache-Control": "no-cache"
}
function addCallback(callback, text) {
	if (!callback) {
	  return text;
	}
	return callback + "( " + text + " );";
};
function fail(response, key) {  
	response.writeHead(403, headers);
	const txt = JSON.stringify({
		msg: "Invalid request: " + key
	})
	response.end(addCallback(u.query.callback, txt));
}

if (!fs.existsSync(config.data_file)) { 
	fs.writeFileSync(config.data_file, JSON.stringify({
		info: {}
	}, null, 2));
}
const ssl_options = {
	cert: fs.readFileSync(config.ssl.cert),
	key: fs.readFileSync(config.ssl.key)
};
const server = https.createServer(ssl_options, (request, response) => {
	const u = url.parse(request.url, true);
	switch (u.pathname) { 
		case "/api/data.csv": { 
			if (u.query.password !== config.password) { 
				response.writeHead(403);
				response.end("Invalid password.");
				return;
			}
			response.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Disposition": "attachment" });
			response.end(output());
			break;
		}
		case "/api/submit": {
			var data = load(config.data_file);
			const id = u.query.id;
			if (isNaN(id)) {
				fail(response);
				return;
			}
			var student = {};
			for (var key of [
				"name",
				"morals",
				"fail_count",
				"points",
				"score",
				"creative",
				"social",
				"arts"
			]) {
				var val = u.query[key];
				if (!val) {
					fail(response, key);
					return;
				}
				if (key !== "name") {
					val = parseFloat(val);
					if (isNaN(val)) {
						fail(response, key);
						return;
					}
				}
				student[key] = val;
			}
			data.info[id] = student;
			fs.writeFile(config.data_file, JSON.stringify(data, null, 2), (err) => {
				if (err) {
					response.writeHead(400, headers);
					const msg = "Write error: " + err.message;
					const txt = JSON.stringify({
						msg: msg
					})
					response.end(addCallback(u.query.callback, txt));
					log.warn(msg);
				} else {
					response.writeHead(200, headers);
					const msg = "Success: " + id;
					const txt = JSON.stringify({
						msg: msg,
						ok: true
					})
					response.end(addCallback(u.query.callback, txt));
					log.info(msg);
				}
			});
			break;
		}
		default: { 
			response.writeHead(404, headers);
			response.end("Not found.");
			return;
		}
	}
});
server.listen(config.port);
