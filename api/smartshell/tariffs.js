const { getToken, graphql, handleError, sendJson } = require('../_smartshell');

module.exports = async function handler(_req, res) {
  try {
    const token = await getToken();
    const data = await graphql(
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
      token,
    );

    sendJson(res, 200, data.tariffs.data);
  } catch (error) {
    handleError(res, error);
  }
};
