import { schema } from "nexus";

import { throwIfNoGroupAccess } from "../../helpers";

// these actions are only for owner of the group

schema.extendType({
    type: "GroupMutation",
    definition(t) {
        t.boolean("transferOwner", {
            // todo
            description: "This action will preserve moderator status to the user and will give moderator s to the new owner as well.",
            args: {
                newOwnerId: schema.stringArg()
            },
            async resolve({ groupId }, { newOwnerId }, { db: prisma, userId }) {
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "owner" });
                await throwIfNoGroupAccess({ groupId, userId: newOwnerId, prisma, level: "member", who: "New owner" });
                await prisma.group.update({
                    where: {
                        id: groupId
                    },
                    data: {
                        ownerId: newOwnerId,
                        members: {
                            update: {
                                where: {
                                    groupId_userId: { groupId, userId: newOwnerId },
                                },
                                data: {
                                    isModerator: true
                                }
                            }
                        }
                    }
                });
                return true;
            }
        });
        // t.boolean("changeWallpapers", {
        //     args: 
        // })
    }
});