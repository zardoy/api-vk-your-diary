import { schema } from "nexus";
import { v1 as uuidv1 } from "uuid";
import { throwIfNoGroupAccess } from "../helpers";
import { VK } from "vk-io";

const JOINED_GROUPS_LIMIT = 20;
const GROUP_MEMBERS_LIMIT = 100;

schema.extendType({
    type: "Query",
    definition(t) {
        // todo full refactor with group { ... }
        t.field("joinedGroups", {
            type: "JoinedGroup",
            list: true,
            async resolve(_root, _args, { vk_params, db: prisma }) {
                if (!vk_params) throw new TypeError("Not auth.");
                const userId = vk_params.user_id;
                const joinedGroups = (await prisma.member.findMany({
                    where: {
                        userId
                    },
                    include: {
                        dedicatedGroup: true
                    }
                })).map(({ isModerator, dedicatedGroup: { id, name, isModerated, ownerId } }) => {
                    return {
                        id,
                        name,
                        ownerId,
                        isModerator: isModerated && isModerator,
                        membersCount: -1,
                        ownerSmallAvatar: "" as string | null
                    };
                });
                if (!joinedGroups.length) return [];

                const userSmallAvatars = await getUserAvatars_50(joinedGroups.map(({ ownerId }) => ownerId));
                for (let i in joinedGroups) {
                    joinedGroups[i].ownerSmallAvatar = userSmallAvatars[joinedGroups[i].ownerId];
                    joinedGroups[i].membersCount = await prisma.member.count({
                        where: {
                            groupId: joinedGroups[i].id
                        }
                    });
                }
                return joinedGroups;
            }
        });
    }
});

const getUserAvatars_50 = async (userIds: string[]): Promise<{ [userId: string]: string | null; }> => {
    const vk = new VK({
        token: process.env.VK_SERVICE_TOKEN!
    });
    const userAvatarsFromVk = await vk.api.users.get({
        user_ids: userIds,
        fields: ["photo_50"]
    });
    return userAvatarsFromVk.reduce((prevObj, { photo_50, id: userId }) => {
        return { ...prevObj, [userId]: photo_50 || null };
    }, {} as Record<string, string | null>);
};

schema.extendType({
    type: "Mutation",
    definition(t) {
        t.field("joinGroup", {
            type: "Boolean",
            args: {
                inviteToken: schema.stringArg()
            },
            async resolve(_root, { inviteToken }, { db: prisma, vk_params }) {
                if (!vk_params) throw new TypeError("Not auth.");
                if (!inviteToken) throw new Error("Invite token can't be empty.");
                const userId = vk_params.user_id;
                const dedicatedGroup = (await prisma.group.findMany({
                    where: {
                        inviteToken
                    }
                }))[0];
                if (!dedicatedGroup) throw new Error("Invalid token.");
                if (
                    await prisma.member.findOne({
                        where: {
                            groupId_userId: { groupId: dedicatedGroup.id, userId }
                        }
                    })
                ) {
                    throw new Error(`You has already joined this group.`);
                }
                if (
                    (await prisma.member.count({
                        where: {
                            userId
                        }
                    })) >= JOINED_GROUPS_LIMIT
                ) {
                    throw new Error(`You have exceeded the groups limit (${JOINED_GROUPS_LIMIT}).`);
                }
                if (
                    (await prisma.member.count({
                        where: {
                            groupId: dedicatedGroup.id
                        }
                    })) >= GROUP_MEMBERS_LIMIT
                ) {
                    throw new Error(`The group has exceeded the limit of members (${GROUP_MEMBERS_LIMIT}).`);
                }
                await prisma.member.create({
                    data: {
                        dedicatedGroup: { connect: { id: dedicatedGroup.id } },
                        userId,
                        //todo default settings
                        trackHometaskCompletion: false,
                        shareHometaskCompletion: false
                    }
                });
                return true;
            }
        });
        t.field("leaveGroup", {
            type: "Boolean",
            args: {
                groupId: schema.intArg()
            },
            async resolve(_root, { groupId }, { db: prisma, vk_params }) {
                if (!vk_params) throw new TypeError("Not auth.");
                const userId = vk_params.user_id;
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "member" });
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
                return true;
            }
        });
        t.field("createGroup", {
            type: "String",
            nullable: true,
            description: "Return an invite token, if appropriate arg is true.",
            args: {
                isModerated: schema.booleanArg(),
                groupName: schema.stringArg(),
                description: schema.stringArg(),
                enableInviteLink: schema.booleanArg()
            },
            async resolve(_root, { isModerated, groupName, description, enableInviteLink }, { vk_params, db: prisma }) {
                if (!vk_params) throw new TypeError("Not auth.");
                if (!groupName) throw new Error("Group name can't be empty.");
                // todo
                if (groupName.length > 50) throw new Error("Group name too large.");
                const userId = vk_params.user_id;
                if (
                    (await prisma.member.count({
                        where: {
                            userId
                        }
                    })) >= JOINED_GROUPS_LIMIT
                ) {
                    throw new Error(`You have exceeded the groups limit (${JOINED_GROUPS_LIMIT}).`);
                }
                await prisma.group.create({
                    data: {
                        isModerated,
                        name: groupName,
                        ownerId: userId,
                        description,
                        inviteToken: enableInviteLink ? uuidv1() : null,
                        members: {
                            create: [{
                                trackHometaskCompletion: false,
                                shareHometaskCompletion: false,
                                userId,
                                isModerator: true
                            }]
                        }
                    }
                });
                return null;
            }
        });
    }
});

schema.objectType({
    name: "JoinedGroup",
    definition(t) {
        t.model("Group").id()
            .name()
            .ownerId();
        t.model("Member").isModerator();
        t.int("membersCount");
        t.string("ownerSmallAvatar", {
            nullable: true
        });
    }
});