/**
 * Parseur XMLTV pour Mon IPTV Pro.
 * Extrait les programmes d'un flux XMLTV (EPG) pour l'associer aux chaines.
 */

function parseXMLTV(xmlString) {
    if (!xmlString) return [];

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");
    
    // Vérifier les erreurs de parsing XML
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
        console.error("Erreur de formatage XML lors de l'import EPG", parserError.textContent);
        return [];
    }

    const programmes = [];
    const programmeNodes = xmlDoc.getElementsByTagName('programme');

    for (let i = 0; i < programmeNodes.length; i++) {
        const node = programmeNodes[i];
        const channelId = node.getAttribute('channel') || '';
        const startRaw = node.getAttribute('start') || '';
        const stopRaw = node.getAttribute('stop') || '';

        const titleNode = node.getElementsByTagName('title')[0];
        const descNode = node.getElementsByTagName('desc')[0];

        const title = titleNode ? titleNode.textContent : 'Pas de titre';
        const desc = descNode ? descNode.textContent : 'Aucune description disponible';

        programmes.push({
            channelId: channelId,
            start: formatEPGTime(startRaw),
            stop: formatEPGTime(stopRaw),
            title: title,
            desc: desc
        });
    }

    return programmes;
}

/**
 * Convertit un format de date EPG "20260621124500 +0200" en heure lisible "12:45"
 */
function formatEPGTime(timeStr) {
    if (!timeStr || timeStr.length < 12) return '';
    try {
        const year = timeStr.substring(0, 4);
        const month = timeStr.substring(4, 6);
        const day = timeStr.substring(6, 8);
        const hour = timeStr.substring(8, 10);
        const min = timeStr.substring(10, 12);
        return `${hour}:${min}`;
    } catch (e) {
        return '';
    }
}
