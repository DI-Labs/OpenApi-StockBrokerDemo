// imports
var request = require('request'); // Rest client
var parseString = require('xml2js').parseString;
var stripPrefix = require('xml2js').processors.stripPrefix;
var Q = require('q');
var uuid = require('uuid');
var stocks = require('./stocks');
var credentials = require('./credentials');

// Session id
const DI_TID = uuid.v4();
// Stored oAuth2 token
var oAuthToken = null;

var controller = {
    /* -- public functions -- */

    /**
     * Used to tell if the user's First Digital account has been linked.
     *
     * @returns {boolean} is user authenticated
     */
    isAccountLinked: function() {
        return !(oAuthToken == null)
    },

    /**
     * Resets the stored oAuth token.
     */
    reset: function() {
        oAuthToken = null;
    },

    /**
     * Authenticates a user given a username and password. After a user has been successfully authenticated,
     * an oAuth2 token for that user will be stored and used in future requests on behalf of the user. If
     * there is an error logging in, the promise error handler will be invoked with the error message.
     *
     * @param username
     * @param password
     * @returns {*|promise}
     */
    authenticate: function (username, password) {
        var deferred = Q.defer();

        // The authorization header should be in the format base64Encode(consumerKey:consumerSecret);
        var authenticationKey = new Buffer(credentials.CONSUMER_KEY + ':' + credentials.CONSUMER_SECRET);
        authenticationKey = authenticationKey.toString('base64');

        // Call the DI open api to authenticate
        request.post({
            url: 'https://diapis.digitalinsight.com/v1/oauth/token',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'someUserAgent',
                'di_fiid': credentials.FIID,
                'di_tid': DI_TID,
                'Authorization': 'Basic ' + authenticationKey
            },
            form: {
                grant_type: 'password',
                username: username,
                password: password
            }
        },
        function (error, response, body) {
            // Rest request has finished

            if (error) {
                // Invoke promise error handler with error message
                deferred.reject(error);
            }
            else {
                // Convert xml response to a json object
                parseString(body, {tagNameProcessors: [stripPrefix]}, function (error, data) {
                    if (!error) {
                        if (data.Status && data.Status.errorInfo) {
                            // An error message was returned from the open api,
                            // so invoke promise error handler with the error
                            deferred.reject(data.Status.statusMessage[0]);
                        }
                        else {
                            // Store user's oAuth2 token
                            oAuthToken = data.token.access_token[0];
                            // Invoke promise success handler
                            deferred.resolve();
                        }
                    }
                    else {
                        // Invoke promise error handler with error message
                        deferred.reject(error);
                    }
                });
            }
        });

        return deferred.promise;
    },

    /**
     * Get the accounts for a user who has authenticated themselves. Accounts will be filtered so only checking accounts
     * will be returned. The accounts will be an array of JSON objects with name, accountNumber, availableBalance,
     * and currentBalance.
     *
     * @returns {*|promise}
     */
    getAccounts: function () {
        var deferred = Q.defer();

        // Add the financial institution ID and customer ID as path variables in the URL.
        var url = 'https://diapis.digitalinsight.com/bankingservices/v2/fis/{di_fiid}/fiCustomers/{di_ficustomer}/accounts';
        url = url.replace('{di_fiid}', credentials.FIID).replace('{di_ficustomer}', credentials.CLIENT_GUID);

        // Call the DI open api to get the user's accounts
        request.get({
            url: url,
            headers: {
                'User-Agent': 'someUserAgent',
                'di_tid': DI_TID,
                'Authorization': 'Bearer ' + oAuthToken
            }
        },
        function (error, response, body) {
            // Rest request has finished

            if (error) {
                // Invoke promise error handler with error message
                deferred.reject(error);
            }
            else {
                // Filter out all non-checking accounts and convert account objects from XML to JSON
                formatAccounts(body).then(
                    function(accounts) {
                        // Invoke promise success handler with accounts
                        deferred.resolve(accounts);
                    },
                    function (error) {
                        // Invoke promise error handler with error message
                        deferred.reject(error);
                    }
                )
            }
        });

        return deferred.promise;
    },

    /**
     * Place an order for stocks. If an account has not been linked, the order will go through regardless of how
     * much money is actually in the user's account. If the account has been linked, the user's checking account
     * balance will be checked before placing the order. If there is not sufficient funds in the account, the
     * order will be rejected with a status of INSUFFICIENT_FUNDS. This check will be skipped when the override
     * flag is set.
     *
     * @param stock - the stock symbol
     * @param quantity - quantity to order
     * @param override - skip insufficient funds check
     * @returns {*|promise}
     */
    placeOrder: function(stock, quantity, override) {
        var deferred = Q.defer();

        // verify a valid stock and quantity were specified
        if (!stocks[stock] || quantity <= 0) {
            deferred.reject('Invalid order. stock: ' + stock + ' quantity: ' + quantity);
        }

        if (this.isAccountLinked() && !override) {
            // If the account is linked, get the user's checking accounts to
            // verify there is enough funds in the accounts.
            this.getAccounts().then(
                function (accounts) {
                    var totalCost = stocks[stock].price * quantity;
                    if (totalCost > accounts[0].availableBalance) {
                        // The order is larger than the available balance
                        // Invoke promise error handler with INSUFFICIENT_FUNDS message
                        deferred.reject('INSUFFICIENT_FUNDS');
                    }
                    else {
                        // There is enough funds in the checking account, proceed with the order.
                        completeOrder(stock, quantity).then(
                            function () {
                                deferred.resolve();
                            }
                        );
                    }
                },
                function (error) {
                    // There was an error retrieving the user's accounts
                    // Invoke promise error handler with error message
                    deferred.reject(error);
                }
            );
        }
        else {
            // Account not linked, place the order.
            completeOrder(stock, quantity).then(
                function () {
                    deferred.resolve();
                }
            );
        }

        return deferred.promise;
    }
};

/* -- private functions -- */

/**
 * Simulates placing an order.
 *
 * @param stock
 * @param quantity
 * @returns {*|promise}
 */
function completeOrder(stock, quantity) {
    var deferred = Q.defer();

    setTimeout(function () {
        console.log('Order placed. ' + quantity + ' shares of ' + stock + ' for $' +
            (stocks[stock].price * quantity).toFixed(2));
        deferred.fulfill();
    }, 1000);

    return deferred.promise;
}

/**
 * Takes the XML response from the get accounts open api and converts it to JSON. All non-checking accounts
 * will be filtered out as they are not needed for this demo.
 *
 * @param xml
 * @returns {*|promise}
 */
function formatAccounts(xml) {
    var deferred = Q.defer();
    parseString(xml, {tagNameProcessors: [stripPrefix]}, function (error, data) {
        if (error) {
            deferred.reject(error);
        }
        var originalAccountList = data.Accounts.account;
        var formattedAccountList = [];
        originalAccountList.forEach(function(originalAccount) {
            if ('CHECKING' === originalAccount.accountType[0]) {
                var account = {
                    name: originalAccount.description[0],
                    accountNumber: originalAccount.displayAccountNumber[0],
                    currentBalance: parseFloat(originalAccount.balance[0].currentBalance[0].amount[0]),
                    availableBalance: parseFloat(originalAccount.balance[0].availableBalance[0].amount[0])
                };
                formattedAccountList.push(account);
            }
        });
        deferred.resolve(formattedAccountList);
    });

    return deferred.promise;
}

module.exports = controller;