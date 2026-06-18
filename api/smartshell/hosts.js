const { getToken, graphql, handleError, sendJson } = require('../_smartshell');

module.exports = async function handler(_req, res) {
  try {
    const token = await getToken();
    const data = await graphql(
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
      token,
    );

    sendJson(res, 200, data.hostsOverview);
  } catch (error) {
    handleError(res, error);
  }
};
