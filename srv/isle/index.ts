import { Client } from 'matrix-org-irc'

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
