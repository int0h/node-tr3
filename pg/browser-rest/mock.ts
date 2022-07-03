import { createCustomRestMockServer } from "../../extensions/mock/rest-mock-server";
import { apiSchema } from "./common";

createCustomRestMockServer({
    apiSchema,
    port: 3000,
});