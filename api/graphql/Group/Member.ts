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