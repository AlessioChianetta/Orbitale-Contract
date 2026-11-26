import { relations } from "drizzle-orm/relations";
import { users, contractTemplates } from "./schema";

export const contractTemplatesRelations = relations(contractTemplates, ({one}) => ({
	user: one(users, {
		fields: [contractTemplates.createdBy],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	contractTemplates: many(contractTemplates),
}));