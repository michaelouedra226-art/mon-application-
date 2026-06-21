/**
 * Parseur M3U développé pour Mon IPTV Pro.
 * Extrait de façon robuste les chaines, logos, urls et catégories des playlists M3U.
 */

function parseM3U(content) {
    if (!content) return [];

    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const channels = [];
    let currentChannel = null;

    // Regex robuste pour capturer les attributs clefs
    const regexLogo = /tvg-logo=["']([^"']+)["']/i;
    const regexName = /tvg-name=["']([^"']+)["']/i;
    const regexGroup = /group-title=["']([^"']+)["']/i;
    const regexId = /tvg-id=["']([^"']+)["']/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('#EXTINF:')) {
            // Initialisation d'une nouvelle chaîne
            currentChannel = {
                id: null, // Sera défini lors de l'enregistrement dans IndexedDB
                name: '',
                logo: '',
                group: 'Général',
                url: '',
                tvgId: ''
            };

            // Extraction du logo
            const logoMatch = line.match(regexLogo);
            if (logoMatch && logoMatch[1]) {
                currentChannel.logo = logoMatch[1].trim();
            }

            // Extraction de la catégorie (groupe)
            const groupMatch = line.match(regexGroup);
            if (groupMatch && groupMatch[1]) {
                currentChannel.group = groupMatch[1].trim();
            }

            // Extraction de l'identifiant EPG (tvg-id)
            const idMatch = line.match(regexId);
            if (idMatch && idMatch[1]) {
                currentChannel.tvgId = idMatch[1].trim();
            }

            // Extraction du nom de la chaîne (fin de ligne après la dernière virgule)
            const commaIndex = line.lastIndexOf(',');
            if (commaIndex !== -1) {
                currentChannel.name = line.substring(commaIndex + 1).trim();
            } else {
                const nameMatch = line.match(regexName);
                if (nameMatch && nameMatch[1]) {
                    currentChannel.name = nameMatch[1].trim();
                } else {
                    currentChannel.name = 'Chaîne inconnue';
                }
            }
        } else if (line && !line.startsWith('#') && currentChannel) {
            // C'est l'URL de la chaîne
            currentChannel.url = line;
            channels.push(currentChannel);
            currentChannel = null; // Prêt pour la prochaine chaîne
        }
    }

    return channels;
}
