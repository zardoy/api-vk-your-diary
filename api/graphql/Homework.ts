import { schema } from "nexus";

import { throwIfNoGroupAccess } from "../helpers";

schema.extendType({
    type: "GroupQuery",
    definition(t) {
        t.field("homeworkFromToday", {
            type: "Hometask",
            list: true,
            args: {
                // user can use vpn so its better to request date from client
                clientDate: schema.arg({ type: "DateTime" }),
                offset: schema.intArg(),
                first: schema.intArg()
            },
            async resolve({ groupId }, { clientDate, offset, first }, { db: prisma, userId }) {
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "member" });
                const date = new Date(clientDate);
                if (isNaN(date.getTime())) throw new Error(`Invalid date in clientDate arg.`);
                return await prisma.hometask.findMany({
                    where: {
                        groupId: groupId,
                        givedTo: {
                            gt: date
                        }
                    },
                    skip: offset,
                    take: first,
                });
            }
        });
        t.field("homeworkByDay", {
            type: "Hometask",
            list: true,
            args: {
                date: schema.arg({ type: "DateTime" })
            },
            async resolve({ groupId }, { date: clientDate }, { db: prisma, userId }) {
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "member" });
                const date = new Date(clientDate);
                if (isNaN(date.getTime())) throw new Error("Invalid date.");
                return await prisma.hometask.findMany({
                    where: {
                        groupId: groupId,
                        givedTo: date
                    }
                });
            }
        });
        t.field("knownSubjects", {
            type: "String",
            list: true,
            async resolve({ groupId }, _args, { db: prisma, userId }) {
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "member" });
                return (await prisma.hometask.findMany({
                    where: {
                        groupId
                    },
                    select: {
                        subject: true
                    },
                    distinct: "subject"
                })).map(({ subject }) => subject);
            }
        });
    }
});

schema.objectType({
    name: "Hometask",
    definition(t) {
        t.model.id()
            .subject()
            .text()
            .createdBy()
            .updatedAt()
            .attachedFiles();
    }
});

schema.objectType({
    name: "File",
    definition(t) {
        t.model.fileId()
            .addedBy()
            .fileLink();
    }
});