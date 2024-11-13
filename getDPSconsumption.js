const ssoAPI = 'https://sso.dynatrace.com/sso/oauth2/token';
const accountManagementAPI = 'https://api.dynatrace.com'
const dynatraceEnvironment = '<YOUR DT TENANT URL>'; // https://XXXX.live.dynatrace.com This is where the new billing metrics will be stored
const dtAPIToken = '<YOUR DT API TOKEN>'; // Api token in the previous environment for billing metrics

// Array with the list of accounts to aggregate info from. ClientID, ClientSecret and accountUuid can be obtained when creating the the OAuth2 client as documented 
// in https://docs.dynatrace.com/docs/manage/identity-access-management/access-tokens-and-oauth-clients/oauth-clients
// Total commit refers to the TCV commit

var accounts = [
	{"name":"", "clientId":"", "clientSecret":"", "accountUuid":"", "total_commit" : XXXXX}
]

for (let i = 0; i < accounts.length; i++) {
	var bearerToken = await getBearerToken (accounts[i].clientId, accounts[i].clientSecret, "urn:dtaccount:"+accounts[i].accountUuid);
	var accountCost = await getAccountCost (bearerToken, accounts[i].accountUuid);
	await postMetric ("billing.commit", "entity="+accounts[i].name, accounts[i].total_commit);
	await postMetric ("billing.cost", "entity="+accounts[i].name, accountCost);
}

async function getBearerToken (clientId, clientSecret, accountUuid) {

	// Convert data object to URL-encoded string  
	var urlencoded = new URLSearchParams();
	urlencoded.append("grant_type", "client_credentials");
	urlencoded.append("client_id", clientId);
	urlencoded.append("client_secret", clientSecret);
	urlencoded.append("scope", "account-uac-read");
	urlencoded.append("resoruce", accountUuid);

	// Make the POST request
	const response = await fetch(ssoAPI, {
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

async function getAccountCost (bearerToken, accountUuid) {
	
	const apiUrl = accountManagementAPI+'/sub/v2/accounts/'+accountUuid+'/subscriptions';
	var cost = 0;

	// Make the POST request
	const response = await fetch(apiUrl, {
		method: 'GET', // *GET, POST, PUT, DELETE, etc.
		headers: {
			'Authorization': 'Bearer '+bearerToken
		}
		});

	const jsonResponse = await response.json();

	// Iterate through the array
	for (let i = 0; i < jsonResponse.data.length; i++) {
		// Check if the status field equals "ACTIVE" or "EXPIRED"
		if (jsonResponse.data[i].status === "ACTIVE" || jsonResponse.data[i].status === "EXPIRED") {
		// Get subscription cost and accumulate it
		cost = cost + await getSubscriptionCost (bearerToken, accountUuid, jsonResponse.data[i].uuid);
		}
	}
	return cost.toFixed(2); // Round cost to 2 decimals
  }


async function getSubscriptionCost(bearerToken, accountUuid, subscriptionUuid) {

	const apiUrl = accountManagementAPI+'/sub/v2/accounts/'+accountUuid+'/subscriptions/'+subscriptionUuid+'/cost';
	var cost = 0;

	// Make the POST request
	const response = await fetch(apiUrl, {
		method: 'GET', // *GET, POST, PUT, DELETE, etc.
		headers: {
		'Authorization': 'Bearer '+bearerToken
		}
	});

	const jsonResponse = await response.json();

	for (let i = 0; i < jsonResponse.data.length; i++) {
		cost = cost + jsonResponse.data[i].value;
	}

	return cost;
}

async function postMetric (metricKey, metricDimensions, metricValue) {

	const apiUrl = dynatraceEnvironment+'/api/v2/metrics/ingest';

 	// Make the POST request
	const response = await fetch(apiUrl, {
		method: 'POST', // *GET, POST, PUT, DELETE, etc.
		headers: {
		'Content-Type': 'text/plain',
		'Authorization': 'Api-Token '+dtAPIToken
		},
		body: metricKey+','+metricDimensions+' '+metricValue
	});

	const jsonResponse = await response.json();
	
	console.log(metricKey+','+metricDimensions+' '+metricValue);
}