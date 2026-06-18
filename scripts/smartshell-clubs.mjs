import { moveCursor } from 'node:readline';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const GRAPHQL_URLS = process.env.SMARTSHELL_GRAPHQL_URL
  ? [process.env.SMARTSHELL_GRAPHQL_URL]
  : [
      'https://billing.smartshell.gg/api/graphql',
      'https://owner.smartshell.gg/api/graphql',
      'https://mobile-auth.smartshell.gg/api/graphql',
      'https://host.smartshell.gg/api/graphql',
    ];

const rl = readline.createInterface({ input, output });

const askHidden = async (question) => {
  const stdin = process.stdin;
  const onData = (char) => {
    const value = char.toString();
    if (value === '\n' || value === '\r' || value === '\u0004') return;
    moveCursor(output, -value.length, 0);
    output.write('*'.repeat(value.length));
  };

  stdin.on('data', onData);
  const answer = await rl.question(question);
  stdin.off('data', onData);
  output.write('\n');
  return answer;
};

const graphql = async (url, query, token) => {
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
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }

  return payload.data;
};

const gqlString = (value) => JSON.stringify(value);

try {
  console.log('SmartShell GraphQL endpoints:');
  for (const url of GRAPHQL_URLS) {
    console.log(`- ${url}`);
  }

  const login = await rl.question('Логин SmartShell: ');
  const password = await askHidden('Пароль SmartShell: ');
  const companyId = await rl.question('company_id, если уже знаешь (Enter чтобы пропустить): ');
  const companyPart = companyId.trim() ? `company_id:${Number(companyId.trim())}` : '';

  const userClubsQuery = `
      query UserClubs {
        userClubs(input:{
          login:${gqlString(login.trim())}
          password:${gqlString(password)}
        }) {
          id
          name
          address
          tariffName
          permitted
          operatorFirstName
          operatorLastName
        }
      }
    `;

  let userClubs;
  let workingUrl;
  const endpointErrors = [];

  for (const url of GRAPHQL_URLS) {
    try {
      console.log(`\nПробую ${url}`);
      userClubs = await graphql(url, userClubsQuery);
      workingUrl = url;
      break;
    } catch (error) {
      endpointErrors.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!userClubs || !workingUrl) {
    throw new Error(`Не найден рабочий endpoint.\n${endpointErrors.join('\n')}`);
  }

  console.log(`\nРабочий endpoint: ${workingUrl}`);

  console.log('\nКлубы, доступные этому аккаунту:\n');
  for (const club of userClubs.userClubs) {
    console.log(`ID: ${club.id}`);
    console.log(`Название: ${club.name || '-'}`);
    console.log(`Адрес: ${club.address || '-'}`);
    console.log(`Тариф лицензии: ${club.tariffName || '-'}`);
    console.log(`Доступ разрешен: ${club.permitted ? 'да' : 'нет'}`);
    console.log(`Оператор: ${[club.operatorFirstName, club.operatorLastName].filter(Boolean).join(' ') || '-'}`);
    console.log('');
  }

  if (companyPart) {
    const auth = await graphql(
      workingUrl,
      `
        mutation Login {
          login(input:{
            login:${gqlString(login.trim())}
            password:${gqlString(password)}
            ${companyPart}
          }) {
            access_token
            token_type
            expires_in
          }
        }
      `,
    );
    console.log(`Токен для указанного company_id получен, истекает через ${auth.login.expires_in} сек.`);
  }

  console.log('Добавь в .env:');
  console.log(`VITE_SMARTSHELL_GRAPHQL_URL=${workingUrl}`);
  console.log('VITE_SMARTSHELL_COMPANY_ID=<ID CyberStreet>');
} catch (error) {
  console.error('\nНе удалось получить список клубов.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  rl.close();
}
