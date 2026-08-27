data remove storage math: error
data modify storage math:internal w_validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/invalid_number/0.start
data modify storage math:internal x set from storage math: a
execute if data storage math:internal {x:0.0f} run data remove storage math: ans
execute if data storage math:internal {x:0.0f} run data modify storage math: error set value "division_by_zero"
execute if data storage math:internal {x:0.0f} run return fail
data modify storage math:internal w_comparison.predicate.reciprocal_input_in_range.minimum set compute default math:internal/comparison/predicate/reciprocal/input_in_range/minimum
execute unless predicate math:internal/reciprocal/input_in_range run data remove storage math: ans
execute unless predicate math:internal/reciprocal/input_in_range run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:internal/reciprocal/input_in_range run return fail
data modify storage math:internal y set value 1.0f
function math:.common/reciprocal/0.start
data modify storage math: ans set compute default math:common/input/x
return 1
