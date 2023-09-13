const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const pino = require('pino'); 

const main = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('authentication');

    const connectToWhatsApp = () => {
        const sock = makeWASocket({
            printQRInTerminal: true,
            auth: state,
            logger: pino({ level: 'fatal' }),
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) connectToWhatsApp();
            } else if (connection === 'open') {
                saveCreds();
                console.log('open');
            }
        });

        sock.ev.on('messages.upsert', (m) => {
            m.messages.forEach((message) => {
                listen_sw(sock, message).catch((e) => console.error(e));
            });
        });
    };

    const getGroup = async (sock) => {
        const groupFilePath = './group.txt';
        if (!fs.existsSync(groupFilePath)) {
            const group_metadata = await sock.groupCreate('📝 KONTAK BELUM DISAVE', []);
            const text = 'instagram.com/theazran_';
            await sock.sendMessage(group_metadata.id, { text });
            fs.writeFileSync(groupFilePath, group_metadata.id);
            return group_metadata.id;
        } else {
            return fs.readFileSync(groupFilePath, 'utf-8');
        }
    };

    const isInDb = (nowa) => {
        const nowasFilePath = './nowas.txt';
        if (!fs.existsSync(nowasFilePath)) {
            fs.writeFileSync(nowasFilePath, '');
        }

        const nowas = fs.readFileSync(nowasFilePath, 'utf-8').split('\n');
        if (!nowas.includes(nowa)) {
            nowas.push(nowa);
            fs.writeFileSync(nowasFilePath, nowas.join('\n'));
            return false;
        } else {
            return true;
        }
    };

    const genVcard = (data) => `BEGIN:VCARD\nVERSION:3.0\nFN:${data.fullName}\nORG:${data.organization};\nTEL;type=CELL;type=VOICE;waid=${data.phoneNumber}:${data.phoneNumber}\nEND:VCARD`;

    const listen_sw = async (sock, message) => {
        if (message.key.remoteJid !== 'status@broadcast' || message.key.fromMe) return;

        const senderNumber = message.key.participant;

        if (isInDb(senderNumber)) return;

        const groupId = await getGroup(sock);

        const vcardData = {
            fullName: message.pushName,
            organization: 'azran.my.id',
            phoneNumber: senderNumber.split('@')[0],
        };

        const vcard = genVcard(vcardData);

        await sock.sendMessage(groupId, {
            contacts: {
                displayName: message.pushName,
                contacts: [{ displayName: message.pushName, vcard }],
            },
        });
    };

    connectToWhatsApp();
};

main();
