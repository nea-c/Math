data modify storage math:internal z set compute default math:common/input/x
data modify storage math:internal w_comparison.predicate.rounding_safe_command_result.maximum set compute default math:internal/comparison/predicate/rounding/safe_command_result/maximum
execute unless predicate math:internal/rounding/safe_command_result run return 1
execute store result storage math:internal z float 1 run compute default math:common/input/x
return 1
