import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type SmartShellEnv = Record<string, string>;

const writeJson = (res: import('node:http').ServerResponse, status: number, payload: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const smartshellApi = (env: SmartShellEnv): Plugin => {
  const endpoint =
    env.SMARTSHELL_GRAPHQL_URL || env.VITE_SMARTSHELL_GRAPHQL_URL || 'https://billing.smartshell.gg/api/graphql';
  const companyId = env.SMARTSHELL_COMPANY_ID || env.VITE_SMARTSHELL_COMPANY_ID;
  let cachedToken: { value: string; expiresAt: number } | null = null;

  const graphql = async <T>(query: string, token?: string): Promise<T> => {
    const response = await fetch(endpoint, {
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

    const payload = (await response.json()) as GraphqlResponse<T>;

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

    if (!env.SMARTSHELL_LOGIN || !env.SMARTSHELL_PASSWORD || !companyId) {
      throw new Error('Set SMARTSHELL_LOGIN, SMARTSHELL_PASSWORD and SMARTSHELL_COMPANY_ID in .env');
    }

    const login = JSON.stringify(env.SMARTSHELL_LOGIN);
    const password = JSON.stringify(env.SMARTSHELL_PASSWORD);
    const data = await graphql<{ login: { access_token: string; expires_in: number } }>(`
      mutation Login {
        login(input: { login:${login}, password:${password}, company_id:${Number(companyId)} }) {
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

  return {
    name: 'cyberstreet-smartshell-api',
    configureServer(server) {
      server.middlewares.use('/api/smartshell/hosts', async (_req, res) => {
        try {
          const accessToken = await getToken();
          const data = await graphql<{ hostsOverview: unknown[] }>(
            `
              query Hosts {
                hostsOverview {
                  id
                  group_id
                  type_id
                  alias
                  position
                  in_service
                  online
                  locked
                  shell_mode
                  comment
                  bookings { id status from to }
                  client_sessions {
                    id
                    duration
                    elapsed
                    time_left
                    started_at
                    finished_at
                  }
                }
              }
            `,
            accessToken,
          );

          writeJson(res, 200, data.hostsOverview);
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      });

      server.middlewares.use('/api/smartshell/tariffs', async (_req, res) => {
        try {
          const accessToken = await getToken();
          const data = await graphql<{ tariffs: { data: unknown[] } }>(
            `
              query Tariffs {
                tariffs(page:1) {
                  data {
                    id
                    title
                    duration
                    description
                    is_active
                    show_in_shell
                    show_in_billing
                    online_booking_enabled
                    price_list {
                      cost_map {
                        title
                        value
                      }
                    }
                  }
                }
              }
            `,
            accessToken,
          );

          writeJson(res, 200, data.tariffs.data);
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), smartshellApi(env)],
    resolve: {
      alias: {
        'react-native': 'react-native-web',
      },
    },
  };
});
