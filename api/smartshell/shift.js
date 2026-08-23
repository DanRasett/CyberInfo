const { getToken, graphql, handleError, sendJson } = require('../_smartshell');

module.exports = async function handler(_req, res) {
  try {
    const token = await getToken();
    const data = await graphql(
      `
        query ActiveShift {
          activeWorkShift {
            worker {
              id
              first_name
              last_name
              middle_name
              nickname
              phone
            }
          }
        }
      `,
      token,
    );

    sendJson(res, 200, data.activeWorkShift ?? null);
  } catch (error) {
    handleError(res, error);
  }
};
