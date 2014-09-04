angular.module('ionic.utils', [])

// Setter and Getter methodes for the $localstorage
.factory('$localstorage', ['$window', function ($window) {
	return {
		set : function (key, value) {
			$window.localStorage[key] = value;
		},
		get : function (key, defaultValue) {
			return $window.localStorage[key] || defaultValue;
		},
		setObject : function (key, value) {
			$window.localStorage[key] = angular.toJson(value);
		},
		insertObject : function (key, value) {
			var objects = angular.fromJson($window.localStorage[key] || '{}');
			objects.push(value);		
			$window.localStorage[key] = angular.toJson(objects);
		},
		getObjects : function (key) {
			return angular.fromJson($window.localStorage[key] || '{}');
		},
		getIndex : function (key, guid) {
			var objects = angular.fromJson($window.localStorage[key] || '{}');
			for (var i = 0; i < objects.length; i++) {
				if (objects[i].guid == guid) {
					return i;
				}
			}
			return -1;
		},
		getObject : function (key, guid) {
			var objects = angular.fromJson($window.localStorage[key] || '{}');
			for (var i = 0; i < objects.length; i++) {
				if (objects[i].guid == guid) {
					return objects[i];
				}
			}
			return -1;
		},
		// TODO kein return Wert
		getCurrencyObject : function (symbol) {
			var objects = angular.fromJson($window.localStorage['currencies'] || '{}');
			for (var i = 0; i < objects.length; i++) {
				if (objects[i].symbol == symbol) {
					return objects[i];
				}
			}
			return -1;
		},
		getObjectById : function (key, id) {
			var objects = angular.fromJson($window.localStorage[key] || '{}');
			for (var i = 0; i < objects.length; i++) {
				if (objects[i].id == id) {
					return objects[i];
				}
			}
			return -1;
		},
		removeObject : function (key, guid) {
			var objects = angular.fromJson($window.localStorage[key] || '{}');
			for (var i = 0; i < objects.length; i++) {
				if (objects[i].guid == guid) {
					objects.splice(i, 1);
					$window.localStorage[key] = angular.toJson(objects);
					return;
				}
			}
		},
		updateObject : function (key, value) {
			var objects = angular.fromJson($window.localStorage[key] || '{}');
			for (var i = 0; i < objects.length; i++) {
				if (objects[i].guid == value.guid) {	
					objects[i] = value;
					$window.localStorage[key] = angular.toJson(objects);
					return;
				}
			}
		}
	}
}]);
angular.module('starter.services', [])

// API: Get the current url form the server
.factory('GetCurrentUrl', function ($http) {
	return {
		get : function (targetServer, companyId) {
			var url = "https://ssl.hrworks.de/cgi-bin/hrw.dll/" + targetServer + "/HrwGetCurrentUrl";
			var jsonObject = {};
			jsonObject.companyId = companyId;
			return $http({
				url : url,
				method : "POST",
				data : angular.toJson(jsonObject),
				headers : {
					'Content-Type' : 'application/x-www-form-urlencoded; charset=UTF-8'
				}
			})
		}
	}
})

// API
.factory('ApiRequester', function ($q, $localstorage, $http, $cordovaDevice, $translate, $ionicPopup, GetCurrentUrl) {
	var translationsArray = [];
	$translate(['NOANSWERFROMTHESERVER_TITLE', 'NOANSWERFROMTHESERVER_TEMPLATE']).then(function (translations) {
		translationsArray["NOANSWERFROMTHESERVER_TITLE"] = translations.NOANSWERFROMTHESERVER_TITLE;
		translationsArray["NOANSWERFROMTHESERVER_TEMPLATE"] = translations.NOANSWERFROMTHESERVER_TEMPLATE;
	})
	generateSignature = function (companyId, personId, request, timeStamp, password) {
		var generatedString = companyId + "\r\n" + personId + "\r\n" + timeStamp + "\r\n" + request + "\r\n";
		return rstr2b64(rstr_hmac_sha1(str2rstr_utf8(password), rstr_sha1(str2rstr_utf8(generatedString))));
	}
	get = function (type, url) {
		var userData = $localstorage.getObjects('user');
		correctReceipts = function (receipts) {
			var newReceipts = [];
			for (var i = 0; i < receipts.length; i++) {
				var theNewReceipt = receipts[i];
				theNewReceipt.date = theNewReceipt.date.replace(/-/g, "");
				if(typeof theNewReceipt.currency !== 'undefined') {
					theNewReceipt.currency = theNewReceipt.currency.symbol;
				}
				if(typeof theNewReceipt.kindOfPayment !== 'undefined') {
					theNewReceipt.kindOfPayment = theNewReceipt.kindOfPayment.id;
				}
				if(typeof theNewReceipt.receiptKind !== 'undefined') {
					if (theNewReceipt.receiptKind.isHotel) {
						theNewReceipt.endDate = theNewReceipt.endDate.replace(/-/g, "");
					}
					theNewReceipt.receiptKind = theNewReceipt.receiptKind.id;
				}
				newReceipts.push(theNewReceipt);
			}
			return newReceipts;
		}
		// TODO: funktioniert dieser Teil?
		var apiName = "HrwGet" + type + "Api";
		var jsonObject = {};
		if (type == "Receipts") {
			apiName = "HrwSynchronizeImportReceiptsApi"
			jsonObject.importReceipts = correctReceipts($localstorage.getObjects('receipts'));
		}
		// TODO: var api ==> apiUrl
		var api = url + apiName;
		var request = apiName + " class";
		//  TODO: var apiVersion = 1;
		// ende
		jsonObject.companyId = userData.companyId;
		jsonObject.personId = userData.personId;
		jsonObject.dateAndTime = (new Date()).toISO8601();
		jsonObject.mobileApplicationAuthorization = "HRworksMobileApp";
		jsonObject.deviceId = $cordovaDevice.getUUID();
		jsonObject.languageKey = $translate.use();
		jsonObject.version = "1";
		jsonObject.isCharsetUtf8 = true;
		jsonObject.signature = generateSignature(jsonObject.companyId, jsonObject.personId, request, jsonObject.dateAndTime, userData.mobilePassword);
		return $http({
			url : api,
			method : "POST",
			data : angular.toJson(jsonObject),
				// TODO: 'Accept-Charset' : undefined ändern
			headers : {
				'Accept-Charset' : undefined
			}
		});
	};
	changeReceiptObject = function (receipts) {
		updatedReceiptsCollection = new Array();
		// TODO was passier bei hotelbeleg mit leerem endDatum
		changeDate = function (theDate) {
			year = theDate.substr(0, 4);
			month = theDate.substr(4, 2);
			day = theDate.substr(6, 2);
			return year + "-" + month + "-" + day;
		}
		for (var i = 0; i < receipts.length; i++) {
			receipt = receipts[i];
			receipt.receiptKind = $localstorage.getObjectById('receiptKinds', receipt.receiptKind);
			receipt.currency = $localstorage.getCurrencyObject(receipt.currency);
			receipt.kindOfPayment = $localstorage.getObjectById('kindsOfPayment', receipt.kindOfPayment);
			receipt.date = changeDate(receipt.date);
			if(typeof receipt.receiptKind !== 'undefined') {
				if (receipt.receiptKind.isHotel) {
					receipt.endDate = changeDate(receipt.endDate);
				}
			}
			updatedReceiptsCollection.push(receipt);
		}
		return updatedReceiptsCollection;
	}
	return {
		synchroniseAll : function () {
			noConnectionToTheServer = function (data) {
				deferred.resolve(data);
				$ionicPopup.alert({
					title : translationsArray["NOANSWERFROMTHESERVER_TITLE"],
					template : translationsArray["NOANSWERFROMTHESERVER_TEMPLATE"]
				});
				return deferred.promise;
			}
			var deferred = $q.defer();
			var userData = $localstorage.getObjects('user');
			// TODO: was ist der Wert von URL
			var url = GetCurrentUrl.get(userData.targetServer, userData.companyId);
			url.success(function (data, status, headers, config) {
				get('KindsOfPayment', data.url).success(function (data, status, headers, config) {
					$localstorage.setObject('kindsOfPayment', data.result);
				}).error(function (data, status, headers, config) {
					noConnectionToTheServer(data);
				}).then(function () {
					get('ReceiptKinds', data.url).success(function (data, status, headers, config) {
						$localstorage.setObject('receiptKinds', data.result);
					}).error(function (data, status, headers, config) {
						noConnectionToTheServer(data);
					}).then(function () {
						get('Currencies', data.url).success(function (data, status, headers, config) {
							$localstorage.setObject('currencies', data.result);
						}).error(function (data, status, headers, config) {
							noConnectionToTheServer(data);
						}).then(function () {
							get('Receipts', data.url).success(function (data, status, headers, config) {
								updatedReceipts = changeReceiptObject(data.result);
								$localstorage.setObject('receipts', updatedReceipts);
								deferred.resolve(data);
							}).error(function (data, status, headers, config) {
								noConnectionToTheServer(data);
							})
						})
					})
				})
			}).error(function (data, status, headers, config) {
				return;
			});
			return deferred.promise;
		},
		userLogout : function (user) {
			var url = GetCurrentUrl.get(user.targetServer, user.companyId);
			var request = "HrwCheckOutDeviceApi class";
			jsonObject = {};
			jsonObject.companyId = user.companyId;
			jsonObject.personId = user.personId;
			jsonObject.dateAndTime = (new Date()).toISO8601();
			jsonObject.mobileApplicationAuthorization = "HRworksMobileApp";
			jsonObject.deviceId = $cordovaDevice.getUUID();
			jsonObject.deviceName = $cordovaDevice.getModel();
			jsonObject.languageKey = $translate.use();
			jsonObject.version = "1";
			jsonObject.isCharsetUtf8 = true;
			jsonObject.signature = generateSignature(jsonObject.companyId, jsonObject.personId, request, jsonObject.dateAndTime, user.mobilePassword);
			url.success(function (data, status, headers, config) {
				$http({
					//TODO: einheidliche headers einfügen für alle requsts
					url : data.url + "HrwCheckOutDeviceApi",
					method : "POST",
					data : angular.toJson(jsonObject)
				})
			})
		},
		userLogin : function (user) {
			var deferred = $q.defer();
			var url = GetCurrentUrl.get(user.targetServer, user.companyId);
			var request = "HrwRegisterDeviceApi class";
			jsonObject = {};
			// TODO: methode erstellen, welches die benutzerdaten selbst in jsonobject speichert und diese in jedem requestbenutzen
			jsonObject.companyId = user.companyId;
			jsonObject.personId = user.personId;
			jsonObject.dateAndTime = (new Date()).toISO8601();
			jsonObject.mobileApplicationAuthorization = "HRworksMobileApp";
			jsonObject.deviceId = $cordovaDevice.getUUID();
			jsonObject.deviceName = $cordovaDevice.getModel();
			jsonObject.languageKey = $translate.use();
			jsonObject.version = "1";
			jsonObject.isCharsetUtf8 = true;
			jsonObject.signature = generateSignature(jsonObject.companyId, jsonObject.personId, request, jsonObject.dateAndTime, user.mobilePassword);
			url.success(function (data, status, headers, config) {
				$http({
					url : data.url + "HrwRegisterDeviceApi",
					method : "POST",
					data : angular.toJson(jsonObject),
					headers : {
					//TODO: einheidliche headers einfügen für alle requsts
						'Content-Type' : 'application/x-www-form-urlencoded;'
					}
				}).success(function (data, status, headers, config) {
					deferred.resolve(data);
				}).error(function () {
					deferred.resolve(data);
					return deferred.promise;
				})
			}).error(function (data, status, headers, config) {
				$ionicPopup.alert({
					title : translationsArray["NOANSWERFROMTHESERVER_TITLE"],
					template : translationsArray["NOANSWERFROMTHESERVER_TEMPLATE"]
				});
				deferred.resolve(data);
				return deferred.promise;
			});
			return deferred.promise;
		}
	}
});