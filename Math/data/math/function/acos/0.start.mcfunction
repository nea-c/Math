data remove storage math: error
data modify storage math:internal w_validation_a set compute default math:internal/comparison/finite/a
execute unless data storage math:internal {w_validation_a:0.0f} run return run function math:.common/_error/invalid_number
data modify storage math:internal x set compute default math:common/input/a
data modify storage math:internal w_comparison.predicate.inverse_trigonometry_input_in_range.minimum set compute default math:internal/comparison/predicate/inverse_trigonometry/input_in_range/minimum
data modify storage math:internal w_comparison.predicate.inverse_trigonometry_input_in_range.maximum set compute default math:internal/comparison/predicate/inverse_trigonometry/input_in_range/maximum
execute if predicate math:internal/inverse_trigonometry/input_in_range run function math:.common/acos/0.start
execute if predicate math:internal/inverse_trigonometry/input_in_range run data modify storage math: ans set from storage math:internal x
execute if predicate math:internal/inverse_trigonometry/input_in_range run return 1
data remove storage math: ans
data modify storage math: error set value "non_real_result"
return fail
