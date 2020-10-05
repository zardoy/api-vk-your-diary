// this file contains general groups logic
// all other files are splitted by access level

import { schema } from "nexus";

schema.extendType({
    type: "Query",
    definition(t) {
        t.field("group", {
            type: "GroupQuery",
            args: {
                id: schema.intArg()
            },
            async resolve(_root, { id }, { vk_params }) {
                return { groupId: id, userId: vk_params.user_id };
            }
        });
    }
});

schema.extendType({
    type: "Mutation",
    definition(t) {
        t.field("group", {
            type: "GroupMutation",
            args: {
                id: schema.intArg()
            },
            async resolve(_root, { id }, { vk_params }) {
                return { groupId: id, userId: vk_params.user_id };
            }
        });
    }
});

export interface GroupRootTyping {
    groupId: number,
    userId: string;
}