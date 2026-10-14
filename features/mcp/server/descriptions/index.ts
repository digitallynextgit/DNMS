// Every endpoint description the AI connector knows, merged. Pure data.
import type { DescriptionMap } from "./types"
import { TIME_LEAVE } from "./time-leave"
import { PEOPLE_COMPANY } from "./people-company"
import { TALENT_PAY } from "./talent-pay"
import { HR_OPS_CONTENT } from "./hr-ops-content"
import { PROJECTS_CORE } from "./projects-core"
import { PROJECT_CONTENT } from "./project-content"
import { PROJECT_TOOLS } from "./project-tools"

export type { DescriptionMap, EndpointDescription } from "./types"

export const ENDPOINT_DESCRIPTIONS: DescriptionMap = {
  ...TIME_LEAVE,
  ...PEOPLE_COMPANY,
  ...TALENT_PAY,
  ...HR_OPS_CONTENT,
  ...PROJECTS_CORE,
  ...PROJECT_CONTENT,
  ...PROJECT_TOOLS,
}
