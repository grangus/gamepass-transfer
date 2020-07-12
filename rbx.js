const request = require("request");
const cheerio = require("cheerio");

module.exports.buyAsset = (shirt, cookie, price, proxy) => {
    return new Promise((res, rej) => {
      let req = request.defaults({ timeout: 10000, proxy: `http://${proxy}` });
      req.get(
        `https://www.roblox.com/catalog/${shirt}`,
        {
          headers: {
            Cookie: `.ROBLOSECURITY=${cookie}`,
          },
          followRedirect: true,
        },
        (error, response, body) => {
          if (error)
            return rej({ data: "Network error! Retrying...", retry: true });
  
          let $ = cheerio.load(body);
  
          let xsrf = body
            .substring(body.lastIndexOf("setToken('") + 10)
            .split("');")[0];
          let expectedSellerId = $("#item-container").attr(
            "data-expected-seller-id"
          );
          let productId = $("#item-container").attr("data-product-id");
  
          req.post(
            `https://economy.roblox.com/v1/purchases/products/${productId}`,
            {
              headers: {
                Cookie: `.ROBLOSECURITY=${cookie}`,
                "x-csrf-token": xsrf,
              },
              json: {
                expectedCurrency: 1,
                expectedPrice: parseInt(price),
                expectedSellerId: parseInt(expectedSellerId),
              },
            },
            (error, response, body) => {
              if (error)
                return rej({ data: "Network error! Retrying...", retry: true });
  
              if (response.statusCode !== 200)
                return rej({
                  data: `Status code was not 200! Status: ${response.statusCode}`,
                  retry: true,
                });
  
              if (!body.purchased) return res(body.errorMsg);
  
              res("Success!");
            }
          );
        }
      );
    });
  };
  