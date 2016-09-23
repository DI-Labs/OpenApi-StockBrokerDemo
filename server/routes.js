// imports
var express = require('express');
var router = express.Router();
var mainController = require('./mainController');

/**
 * API handler for clearing the stored oAuth2 token. For the sake of the
 * demo, the oAuth2 token is cleared when the page is refreshed.
 */
router.post('/reset', function(req, res, next) {
    mainController.reset();
    res.sendStatus(200);
});

/**
 * API handler for linking a user's financial institution account.
 * The request body should be in JSON format with a field for the
 * user's username and password. An error will be returned if the
 * credentials are invalid.
 */
router.post('/linkAccount', function (req, res, next) {
    var username = req.body.username;
    var password = req.body.password;

    mainController.authenticate(username, password).then(
        function () {
            res.sendStatus(200);
        },
        function (error) {
            console.error(error);
            res.status(401).send(error);
        }
    )
});

/**
 * API handler for placing an order for stocks. The request body
 * should contain the stock symbol and a quantity to purchase. An optional
 * override flag can be specified to ignore the INSUFFICIENT_FUNDS error.
 */
router.post('/placeOrder', function (req, res, next) {
    try {
        var stock = req.body.stock;
        var quantity = req.body.quantity;
        var override = req.body.override;
        var response = {
            status: 'UNKNOWN_ERROR'
        };

        mainController.placeOrder(stock, quantity, override).then(
            function () {
                response.status = 'SUCCESS';
                res.status(200).send(response);
            },
            function (error) {
                if ('INSUFFICIENT_FUNDS' == error) {
                    response.status = error;
                    res.status(200).send(response)
                }
                else {
                    res.status(500).send(response);
                }
            }
        );
    }
    catch (exception) {
        console.error(exception);
    }
});

/**
 * Serves the static on the application root.
 */
router.get('/*', function(req, res, next) {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

module.exports = router;
