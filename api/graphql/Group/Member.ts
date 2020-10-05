import { schema } from "nexus";

import { throwIfNoGroupAccess } from "../../helpers";

schema.objectType({
    name: "GroupQuery",
    rootTyping: "GroupRootTyping",
    definition(t) {
        t.string("groupInviteKey", {
            nullable: true,
            async resolve({ groupId, userId }, _args, { db: prisma }) {
                await throwIfNoGroupAccess({ userId, groupId, prisma, level: "member" });
                return (await prisma.group.findOne({
                    where: {
                        id: groupId
                    },
                    select: {
                        inviteToken: true
                    }
                }))!.inviteToken;
            }
        });
        t.list.string("groupMembers", {
            // nullable: true, can be hidden in the future?
            async resolve({ groupId, userId }, _args, { db: prisma }) {
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "member" });
                return (await prisma.member.findMany({
                    where: {
                        groupId
                    },
                    select: {
                        userId: true
                    }
                })).map(({ userId }) => userId);
            }
        });
        t.string("groupDescription", {
            async resolve({ groupId, userId }, _args, { db: prisma }) {
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "member" });
                return (await prisma.group.findOne({
                    where: {
                        id: groupId
                    },
                    select: {
                        description: true
                    }
                }))!.description;
            }
        });
    }
});

schema.objectType({
    name: "GroupMutation",
    rootTyping: "GroupRootTyping",
    definition(t) {
        t.field("leaveForever", {
            type: "Boolean",
            async resolve({ groupId, userId }, _args, { db: prisma }) {
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "member" });
                const groupMembersCount = await prisma.member.count({
                    where: {
                        groupId
                    }
                });
                if (groupMembersCount > 1) {
                    const group = (await prisma.group.findOne({
                        where: { id: groupId },
                        select: { ownerId: true }
                    }))!;
                    if (group.ownerId === userId) throw new Error(`You need to transfer owner first.`);
                    await prisma.member.delete({
                        where: {
                            groupId_userId: { groupId, userId }
                        }
                    });
                } else {
                    await prisma.group.delete({
                        where: {
                            id: groupId
                        }
                    });
                }
                return true;
            }
        });
    }
});