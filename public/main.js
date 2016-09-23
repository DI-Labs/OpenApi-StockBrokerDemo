$(function() {
    var stocks = {
        acme: {
            name: 'Acme',
            symbol: 'acme',
            price: 113.75
        },
        glob: {
            name: 'Globex',
            symbol: 'glob',
            price: 56.81
        },
        init: {
            name: 'Initech',
            symbol: 'init',
            price: 780.22
        },
        umbr: {
            name: 'Umbrella',
            symbol: 'umbr',
            price: 128.64
        }
    };

    // Default the selection to appl. This will be overriden when the
    // user selects to buy a stock.
    var selectedStock = stocks.appl;
    var currentBuyState = 'INITIAL';

    // Make request to clear the user's data from the server
    function clearState() {
        $.ajax({
            type: 'POST',
            url: 'reset',
            contentType: 'application/json',
            success: function() {
                // login information removed from server
            },
            error: function(error) {
                console.error('error: ' + error);
            }
        })
    }
    
    function initHandlers() {
        // Handle the initial buy request
        $('.buy-button').click(function () {
            var stock = $(this).data('stock');
            selectedStock = stocks[stock];

            var modelHeader = 'Buy ' + selectedStock.name + ' Stock';

            $('#buyModalTitle').text(modelHeader);
            $('#modalStockPrice').text(selectedStock.price.toFixed(2));
            $('#modalTotalPrice').text('0.00');
            $('#buyConfirmButton').prop('disabled', true);
            $('#quantityInput').val('0');
        });

        // Update the total price field when the quantity input has been updated
        $('#quantityInput').on('change keyup paste input', function (event) {
            var totalPrice = 0;
            var quantity = parseFloat($('#quantityInput').val());
            if (!quantity || quantity < 0) {
                quantity = 0;
            }

            totalPrice = quantity * selectedStock.price;
            $('#modalTotalPrice').text(totalPrice.toFixed(2));
            $('#buyConfirmButton').prop('disabled', !totalPrice);
        });

        // reset buyModal state whenever it is opened up
        $('#buyModal').on('show.bs.modal', function () {
            var buyLoaderElement = $('#buyLoader');
            var initialBuyFormElement = $('#initialBuyForm');
            var confirmTradeElement = $('#confirmTrade');
            var successTradeElement = $('#successTrade');
            var quantityInputElement = $('#quantityInput');

            currentBuyState = 'INITIAL';
            buyLoaderElement.hide();
            initialBuyFormElement.show();
            confirmTradeElement.hide();
            successTradeElement.hide();
            quantityInputElement.val('0');
        });

        // Handle the request to complete a purchase
        $('#buyConfirmButton').on('click', function () {
            var buyLoaderElement = $('#buyLoader');
            var initialBuyFormElement = $('#initialBuyForm');
            var confirmTradeElement = $('#confirmTrade');
            var successTradeElement = $('#successTrade');
            var successMessageElement = $('#tradeSuccessStatus');

            var quantity = parseFloat($('#quantityInput').val());

            if ('INITIAL' == currentBuyState || 'INSUFFICIENT_FUNDS' == currentBuyState) {
                initialBuyFormElement.hide();
                confirmTradeElement.hide();
                buyLoaderElement.show();
                $.ajax({
                    type: 'POST',
                    url: 'placeOrder',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        stock: selectedStock.symbol,
                        quantity: quantity,
                        override: 'INSUFFICIENT_FUNDS' == currentBuyState
                    }),
                    success: function (response) {
                        if ('INSUFFICIENT_FUNDS' == response.status) {
                            hideAndShow(buyLoaderElement, confirmTradeElement);
                            currentBuyState = 'INSUFFICIENT_FUNDS';
                        }
                        else {
                            hideAndShow(buyLoaderElement, successTradeElement);
                            currentBuyState = 'SUCCESS';
                            successMessageElement.text('Your order for ' + quantity +
                                ' shares of ' + selectedStock.symbol + ' has been successfully placed for ' +
                                '$' + (quantity * selectedStock.price).toFixed(2) + '.');
                        }
                    },
                    error: function (error) {
                        console.error('error:');
                        console.error(error);
                        $('#buyModal').modal('hide');
                    }
                });
            }
            else {
                $('#buyModal').modal('hide');
            }
        });

        // Clear the state of the account link modal whenever it is open
        $('#linkAccountModal').on('show.bs.modal', function () {
            var loginError = $('#loginError');
            loginError.hide();
        });

        // Handle the account linking request
        $('#linkAccountButton').on('click', function () {
            var loginFormElement = $('#loginForm');
            var loginLoaderElement = $('#loginLoader');
            var loginErrorElement = $('#loginError');
            var usernameInput = $('#usernameInput');
            var passwordInput = $('#passwordInput');
            var username = usernameInput.val();
            var password = passwordInput.val();
            usernameInput.val('');
            passwordInput.val('');

            hideAndShow(loginFormElement, loginLoaderElement);

            $.ajax({
                type: 'POST',
                url: 'linkAccount',
                contentType: 'application/json',
                data: JSON.stringify({
                    username: username,
                    password: password
                }),
                success: function() {
                    hideAndShow(loginLoaderElement, loginFormElement);
                    $('#linkAccountModal').modal('hide');
                },
                error: function(error) {
                    hideAndShow(loginLoaderElement, loginFormElement);
                    loginErrorElement.text(error.responseText);
                    loginErrorElement.show();
                }
            })
        })
    }

    function hideAndShow(element1, element2) {
        element1.hide();
        element2.show();
    }

    function init() {
        clearState();
        initHandlers();
    }

    init();
});