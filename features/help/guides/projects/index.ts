import type { HelpGuide } from "../../types"
import { myProjectsGuide } from "./my-projects"
import { projectWorkspaceGuide } from "./project-workspace"
import { projectTasksGuide } from "./project-tasks"
import { projectGoalsGuide } from "./project-goals"
import { projectRequirementsGuide } from "./project-requirements"
import { projectChatsGuide } from "./project-chats"
import { projectPasswordsGuide } from "./project-passwords"
import { myTasksGuide } from "./my-tasks"
import { progressGuide } from "./progress"
import { workReportsGuide } from "./work-reports"

/** My Projects, the project workspace, My Tasks, Progress, Work Report. In the order they are listed. */
export const projectGuides: HelpGuide[] = [
  myProjectsGuide,
  projectWorkspaceGuide,
  projectTasksGuide,
  projectGoalsGuide,
  projectRequirementsGuide,
  projectChatsGuide,
  projectPasswordsGuide,
  myTasksGuide,
  progressGuide,
  workReportsGuide,
]
