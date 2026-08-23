const DEFAULT_GRAPHQL_URLS = [
  'https://billing.smartshell.gg/api/graphql',
  'https://owner.smartshell.gg/api/graphql',
  'https://mobile-auth.smartshell.gg/api/graphql',
  'https://host.smartshell.gg/api/graphql',
];

let cachedToken = null;
let workingGraphqlUrl = null;

const GRAPHQL_URLS = [
  process.env.SMARTSHELL_GRAPHQL_URL,
  process.env.VITE_SMARTSHELL_GRAPHQL_URL,
  ...DEFAULT_GRAPHQL_URLS,
].filter((url, index, list) => typeof url === 'string' && url.length > 0 && list.indexOf(url) === index);

const graphqlAt = async (url, query, token) => {
  const response = await fetch(url, {
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

const graphql = async (query, token) => {
  const urls = workingGraphqlUrl
    ? [workingGraphqlUrl, ...GRAPHQL_URLS.filter((url) => url !== workingGraphqlUrl)]
    : GRAPHQL_URLS;
  const errors = [];

  for (const url of urls) {
    try {
      const data = await graphqlAt(url, query, token);
      workingGraphqlUrl = url;
      return data;
    } catch (error) {
      errors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(errors.join('; '));
};

const getToken = async () => {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const { SMARTSHELL_LOGIN, SMARTSHELL_PASSWORD } = process.env;
  const companyId = process.env.SMARTSHELL_COMPANY_ID || process.env.VITE_SMARTSHELL_COMPANY_ID;

  if (!SMARTSHELL_LOGIN || !SMARTSHELL_PASSWORD || !companyId) {
    throw new Error('Set SMARTSHELL_LOGIN, SMARTSHELL_PASSWORD and SMARTSHELL_COMPANY_ID');
  }

  const data = await graphql(`
    mutation Login {
      login(input: {
        login:${JSON.stringify(SMARTSHELL_LOGIN)}
        password:${JSON.stringify(SMARTSHELL_PASSWORD)}
        company_id:${Number(companyId)}
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
