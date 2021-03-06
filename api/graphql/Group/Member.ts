import { schema } from "nexus";

import { throwIfNoGroupAccess } from "../../helpers";

schema.objectType({
    name: "GroupQuery",
    rootTyping: "GroupRootTyping",
    definition(t) {
        t.string("inviteKey", {
            nullable: true,
            async resolve({ groupId }, _args, { db: prisma, userId }) {
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
        t.list.string("members", {
            // nullable: true, todo make owner possible to hide that
            description: "Query this only if isModerator is true from joinedGroups query",
            async resolve({ groupId }, _args, { db: prisma, userId }) {
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "member" });
                const usersGroup = (await prisma.group.findOne({
                    where: {
                        id: groupId
                    }
                }))!;
                if (!usersGroup.isModerated) throw new Error(`This query allowed only in moderated groups.`);
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
        t.string("description", {
            async resolve({ groupId }, _args, { db: prisma, userId }) {
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
            async resolve({ groupId }, _args, { db: prisma, userId }) {
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