const https = require('https');

/**
 * Récupère la version la plus récente à partir du `package.json` hébergé sur dmon.fr.
 * En cas d'erreur réseau, SSL ou de parsing, renvoie `null` (tolérance aux erreurs).
 *
 * @returns {Promise<string|null>} Version (ex: "1.2.0") ou `null` si indisponible.
 */
async function getLatestVersion() {
    return new Promise((resolve) => {
        const agent = new https.Agent({ rejectUnauthorized: false });
        const options = {
            hostname: 'dmon.fr',
            path: '/package.json',
            method: 'GET',
            agent: agent
        };

        https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log("Latest version fetched:", json.version);
                    resolve(json.version || null);
                } catch (e) {
                    console.error("Error parsing JSON:", e.message);
                    resolve(null);
                }
            });
        }).on('error', (error) => {
            console.error("Error fetching latest version:", error.message);
            resolve(null);
        }).end();
    });
}

module.exports = {
    getLatestVersion
};