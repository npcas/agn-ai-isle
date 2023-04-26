import { Client, IrcClientOpts } from 'matrix-org-irc'

interface IrcServerOpts {
    ico?: IrcClientOpts;
    nickWhitelist?: Set<string>;
}

export class Isleman {
    static admin?: string;

    static readonly #servers = new Map<string, IrcServerOpts>();
    static readonly #instances = new Map<string, Isleman>();

    static init() {
        this.#servers.set('testnet.ergo.chat', {});
        // TODO: populate this.#servers from database
    }

    readonly #users = new Set<string>();
    readonly #ico?: IrcClientOpts;
    #disabled?: string;
    #uplink?: Client;

    private constructor(
        public readonly server: string,
        public readonly nick: string,
        user: string
    ) {
        // TODO: populate this.#users, this.#ico and this.#disabled from database
        
    }

    static possess(server: string, nick: string, user: string): Isleman {
        const auth = nick + '@' + server;
        let pawn = this.#instances.get(auth);

        if (pawn) {
            if (user === this.admin || pawn.#users.has(user)) return pawn;
            else throw 'Access denied.';
        }

        const iso = this.#servers.get(server);
        if (!iso) throw 'Unknown server.';
        if (iso.nickWhitelist && !iso.nickWhitelist.has(user)) throw 'Access denied.';
        pawn = new this(server, nick, user);
        if (pawn.#disabled) throw `Access denied (${pawn.#disabled}).`;
        const ico: IrcClientOpts = Object.assign({}, iso.ico, pawn.#ico);

    }

    hookup(user: string) {
        if (this.#uplink) throw 'Already online.';
        const ico: IrcClientOpts = Object.assign({}, Isleman.#servers.get(this.server)?.ico, this.#ico);
        this.#uplink = new Client(this.server, this.nick, ico);

        this.#uplink.once('registered', () => {
            // this.#password = password;
            console.log(`Uplink to ${this.nick}@${this.server} established.`);
        });
    }

    shutoff(password?: string) {
        // if (this.#password !== password) throw 'Wrong password.';
        if (!this.#uplink) throw 'Already offline.';
        this.#uplink.disconnect();
        this.#uplink = undefined;
        console.log(`Uplink to ${this.nick}@${this.server} dismissed.`);
    }
}

export class Isle {
    readonly #uplinks = new Map<string, Client>();

    attach(auth: string) {
        const rer = /^([^@]*)@(.*)$/.exec(auth);
        if (rer === null) throw 'Illegal authority!';
        const irc = new Client(rer[2], rer[1], {});

        irc.once('registered', () => {
            this.#uplinks.set(auth, irc);
            console.log(`Uplink to ${auth} established.`);
        });
    }

    detach(auth: string) {
        const irc = this.#uplinks.get(auth);
        if (irc === undefined) return;
        irc.disconnect();
        this.#uplinks.delete(auth);
        console.log(`Uplink to ${auth} dismissed.`);
    }
}
