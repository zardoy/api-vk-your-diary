const NOT_A_MEMBER_ERROR_MESSAGE = ` not a member of this group.`;

export const throwIfNoGroupAccess = async (
    // groupId - always id of THIS group
    { groupId, userId, prisma, level, who }:
        { groupId: number; userId: string; prisma: NexusContext["db"], level: "member" | "moderator" | "owner", who?: string; }
): Promise<void> => {
    if (!who) who = "You are";
    if (level === "owner") {
        const ownersGroup = await prisma.group.findOne({
            where: {
                id: groupId
            },
            select: {
                ownerId: true
            }
        });
        if (!ownersGroup) throw new Error(who + NOT_A_MEMBER_ERROR_MESSAGE);
        if (ownersGroup.ownerId !== userId) throw new Error(`${who} not an owner of this group.`);
    } else {
        const joinedUserEntry = await prisma.member.findOne({
            where: {
                groupId_userId: {
                    userId,
                    groupId
                }
            },
            select: {
                isModerator: true
            }
        });
        if (!joinedUserEntry) throw new Error(who + NOT_A_MEMBER_ERROR_MESSAGE);
        if (level === "moderator") {
            if (joinedUserEntry.isModerator) return;
            const usersGroup = (await prisma.group.findOne({
                where: {
                    id: groupId
                },
                select: {
                    isModerated: true
                }
            }))!;
            if (usersGroup.isModerated) throw new Error(`${who} not a moderator of this group.`);
        }
    }
};