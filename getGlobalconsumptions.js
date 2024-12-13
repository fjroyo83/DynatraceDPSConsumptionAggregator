const ssoAPI = 'https://sso.dynatrace.com/sso/oauth2/token';
const accountManagementAPI = 'https://api.dynatrace.com';
const date = new Date();

// Array with the list of accounts to aggregate info from. ClientID, ClientSecret and accountUuid can be obtained when creating the the OAuth2 client as documented 
// in https://docs.dynatrace.com/docs/manage/identity-access-management/access-tokens-and-oauth-clients/oauth-clients
// Total commit refers to the TCV commit

const accounts = [
	{"name":"", "clientId":"", "clientSecret":"", "accountUuid":"", "commit" : XXXX, "currency":"USD"}
]

const reportingAccount = {"tenantURL":'', "apiToken":""}

main();

async function main() {

	for (var account of accounts) {
		console.log("Processing " + account.name);
		var bearerToken = await getBearerToken (ssoAPI, account.clientId, account.clientSecret, "urn:dtaccount:"+account.accountUuid,"account-uac-read");
		var accountConsupmtion = await getAccountConsumption (bearerToken, account.accountUuid);
		var costBizEvent = {
			"event.type": "dps.cost.booked",
			"event.provider": "dps4ma.ingester",
			"accountUuid": account.accountUuid,
			"accountName": account.name,
			"consumption": accountConsupmtion,
			"commit": account.commit,
			"currency": account.currency,
			"timestamp": date
		}
		sendBizEvent(costBizEvent);
	}
}

async function getBearerToken (URL, clientId, clientSecret, accountUuid, scope) {

	// Convert data object to URL-encoded string  
	var urlencoded = new URLSearchParams();
	urlencoded.append("grant_type", "client_credentials");
	urlencoded.append("client_id", clientId);
	urlencoded.append("client_secret", clientSecret);
	urlencoded.append("scope", scope);
	urlencoded.append("resoruce", accountUuid);

	// Make the POST request
	const response = await fetch(URL, {
	  method: 'POST', // *GET, POST, PUT, DELETE, etc.
	  headers: {
		'Content-Type': 'application/x-www-form-urlencoded'
	  },
	  body: urlencoded // body data type must match "Content-Type" header
	});
	// Parse the JSON response
	const jsonResponse = await response.json();
	return jsonResponse.access_token;
}

async function getAccountConsumption (bearerToken, accountUuid) {
	
	const apiUrl = accountManagementAPI+'/sub/v2/accounts/'+accountUuid+'/subscriptions';
	var consumption = 0;

	// Make the POST request
	const response = await fetch(apiUrl, {
		method: 'GET', // *GET, POST, PUT, DELETE, etc.
		headers: {
			'Authorization': 'Bearer '+bearerToken
		}
		});

	const jsonResponse = await response.json();

	// Iterate through the array
	for (var subscription of jsonResponse.data) {
				// Check if the status field equals "ACTIVE" or "EXPIRED"
		if (subscription.status === "ACTIVE" || subscription.status === "EXPIRED") {
		// Get subscription cost and accumulate it
		consumption = consumption + await getSubscriptionConsumption (bearerToken, accountUuid, subscription.uuid);
		}
	}
	return Number(consumption.toFixed(2)); // Round cost to 2 decimals
  }


async function getSubscriptionConsumption(bearerToken, accountUuid, subscriptionUuid) {

	const apiUrl = accountManagementAPI+'/sub/v2/accounts/'+accountUuid+'/subscriptions/'+subscriptionUuid+'/cost';
	var consumption = 0;

	// Make the POST request
	const response = await fetch(apiUrl, {
		method: 'GET', // *GET, POST, PUT, DELETE, etc.
		headers: {
		'Authorization': 'Bearer '+bearerToken
		}
	});

	const jsonResponse = await response.json();

	for (var cost of jsonResponse.data) {
		consumption = consumption + cost.value;
	}
	return consumption;
}

async function sendBizEvent (costBizEvent) {
	const apiUrl = reportingAccount.tenantURL+'/api/v2/bizevents/ingest';
 	// Make the POST request
 	const response = await fetch(apiUrl, {
		method: 'POST', // *GET, POST, PUT, DELETE, etc.
		headers: {
		'Authorization': 'Api-Token '+reportingAccount.apiToken,
		'Content-Type': 'application/json'
	},
		body: JSON.stringify(costBizEvent)
	});
	const jsonResponse = await response.json();
	console.log("Event sent: " + JSON.stringify(costBizEvent));
}