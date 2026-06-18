const GRAPHQL_URL = process.env.SMARTSHELL_GRAPHQL_URL || 'https://billing.smartshell.gg/api/graphql';

let cachedToken = null;

const graphql = async (query, token) => {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`SmartShell HTTP ${response.status}`);
  }

  const payload = await response.json();

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }

  if (!payload.data) {
    throw new Error('SmartShell returned empty data');
  }

  return payload.data;
};

const getToken = async () => {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const { SMARTSHELL_LOGIN, SMARTSHELL_PASSWORD, SMARTSHELL_COMPANY_ID } = process.env;

  if (!SMARTSHELL_LOGIN || !SMARTSHELL_PASSWORD || !SMARTSHELL_COMPANY_ID) {
    throw new Error('Set SMARTSHELL_LOGIN, SMARTSHELL_PASSWORD and SMARTSHELL_COMPANY_ID');
  }

  const data = await graphql(`
    mutation Login {
      login(input: {
        login:${JSON.stringify(SMARTSHELL_LOGIN)}
        password:${JSON.stringify(SMARTSHELL_PASSWORD)}
        company_id:${Number(SMARTSHELL_COMPANY_ID)}
      }) {
        access_token
        expires_in
      }
    }
  `);

  cachedToken = {
    value: data.login.access_token,
    expiresAt: Date.now() + Math.max(60, data.login.expires_in - 3600) * 1000,
  };

  return cachedToken.value;
};

const sendJson = (res, status, payload) => {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const handleError = (res, error) => {
  sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
};

module.exports = {
  getToken,
  graphql,
  handleError,
  sendJson,
};
