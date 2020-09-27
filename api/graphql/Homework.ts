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
                clientDate: schema.stringArg(),
                offset: schema.intArg(),
                first: schema.intArg()
            },
            async resolve({ groupId, userId }, { clientDate, offset, first }, { db: prisma }) {
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "member" });
                const date = new Date(clientDate);
                if (isNaN(date.getTime())) throw new Error("Invalid date.");
                return await prisma.hometask.findMany({
                    where: {
                        groupId: groupId,
                        createdBy: {
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
                // todo change to timestamp?
                date: schema.stringArg()
            },
            async resolve({ groupId, userId }, { date: clientDate }, { db: prisma }) {
                await throwIfNoGroupAccess({ groupId, userId, prisma, level: "member" });
                const date = new Date(clientDate);
                if (isNaN(date.getTime())) throw new Error("Invalid date.");
                return await prisma.hometask.findMany({
                    where: {
                        groupId: groupId,
                        createdBy: date
                    }
                });
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