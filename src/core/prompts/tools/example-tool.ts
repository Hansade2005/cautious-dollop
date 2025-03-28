import { ToolArgs } from "./types"

export function getExampleToolDescription(args: ToolArgs): string | undefined {
  return `## example_tool
Description: Example tool that demonstrates the tool structure.
Parameters:
- param1: (required) Description of first parameter
- param2: (optional) Description of second parameter
Usage:
<example_tool>
<param1>Value for param1</param1>
<param2>Optional value for param2</param2>
</example_tool>`
}
