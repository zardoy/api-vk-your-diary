import { schema } from "nexus";
import { v1 as uuidv1 } from "uuid";
import { throwIfNoGroupAccess } from "../../helpers";

schema.objectType({
    name: "GroupMutation",
    rootTyping: "GroupRootTyping",
    definition(t) {
        t.field("addHometask", {
            type: "HometaskIdOnly",
            args: {
                subject: schema.stringArg(),
                text: schema.stringArg(),
                // filesId: schema.
            },
            async resolve({ groupId, userId }, { subject, text }, { db: prisma }) {
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "moderator" });
                return await prisma.hometask.create({
                    data: {
                        dedicatedGroup: { connect: { id: groupId } },
                        createdBy: userId,
                        subject,
                        text
                    },
                    select: {
                        id: true
                    }
                });
            }
        });
        t.boolean("removeHometask", {
            args: {
                hometaskId: schema.intArg()
            },
            async resolve({ groupId, userId }, { hometaskId }, { db: prisma }) {
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "moderator" });
                if (
                    ((await prisma.hometask.findOne({
                        where: {
                            id: hometaskId
                        },
                        select: { groupId: true }
                    })) || { groupId: null }).groupId !== groupId
                ) {
                    // todo norm err msg
                    throw new Error("Can't delete hometask");
                }
                await prisma.hometask.delete({
                    where: { id: hometaskId }
                });
                return true;
            }
        });
        t.boolean("editHometask", {
            args: {
                hometaskId: schema.intArg(),
                newText: schema.stringArg()
            },
            async resolve({ groupId, userId }, { hometaskId, newText }, { db: prisma }) {
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "moderator" });
                if (
                    ((await prisma.hometask.findOne({
                        where: {
                            id: hometaskId
                        },
                        select: { groupId: true }
                    })) || { groupId: null }).groupId !== groupId
                ) {
                    // todo norm err msg
                    throw new Error("Can't edit hometask");
                }
                await prisma.hometask.update({
                    where: { id: hometaskId },
                    data: { text: newText }
                });
                return true;
            }
        });
        t.string("generateNewInviteToken", {
            description: "Returns a new token",
            async resolve({ groupId, userId }, _args, { db: prisma }) {
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "moderator" });
                const group = (await prisma.group.findOne({
                    where: { id: groupId }
                }))!;
                if (group.inviteToken === null) throw new Error("Invite link disabled by the owner.");
                return (await prisma.group.update({
                    where: {
                        id: groupId
                    },
                    data: {
                        inviteToken: uuidv1()
                    }
                })).inviteToken!;
            }
        });
        t.boolean("kickMember", {
            description: "Only owner can kick moderators",
            args: {
                memberIdToKick: schema.stringArg()
            },
            async resolve({ groupId, userId }, { memberIdToKick }, { db: prisma }) {
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "moderator" });
                const group = (await prisma.group.findOne({
                    where: {
                        id: groupId
                    },
                    select: {
                        ownerId: true,
                        isModerated: true,
                        members: true
                    }
                }))!;
                if (memberIdToKick === group.ownerId) throw new Error(`Can't kick group owner.`);
                const foundMemberToKick = group.members.find(({ userId: userIdInGroup }) => userIdInGroup === memberIdToKick);
                if (!foundMemberToKick) throw new Error(`User to kick is not a member of this group.`);
                if (userId !== group.ownerId) {
                    if (!group.isModerated) throw new Error("Only owner can kick members in free groups.");
                    if (foundMemberToKick.isModerator) throw new Error(`Only owner can kick group moderators.`);
                }
                await prisma.member.delete({
                    where: {
                        groupId_userId: { groupId, userId: memberIdToKick }
                    }
                });
                return true;
            }
        });
    }
});

schema.objectType({
    name: "HometaskIdOnly",
    definition(t) {
        t.model("Hometask").id();
    }
});