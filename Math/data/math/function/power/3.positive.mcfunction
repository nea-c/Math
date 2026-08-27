function math:.common/log/0.start
data modify storage math:internal x set compute default math:power/positive/00
data modify storage math:internal w_comparison.predicate.exp_input_finite.minimum set compute default math:internal/comparison/predicate/exp/input_finite/minimum
data modify storage math:internal w_comparison.predicate.exp_input_finite.maximum set compute default math:internal/comparison/predicate/exp/input_finite/maximum
execute unless predicate math:internal/exp/input_finite run return run function math:power/5.nonfinite_positive
data modify storage math:internal w_comparison.predicate.exp_underflows_to_zero.maximum set compute default math:internal/comparison/predicate/exp/underflows_to_zero/maximum
execute if predicate math:internal/exp/underflows_to_zero run data modify storage math: ans set value 0.0f
execute if predicate math:internal/exp/underflows_to_zero run return 1
execute if data storage math:internal {x:-103.97207641601562f} run data modify storage math: ans set compute default math:exp/minimum/00
execute if data storage math:internal {x:-103.97207641601562f} run return 1
data modify storage math:internal w_comparison.predicate.power_needs_overflow_classification.minimum set compute default math:internal/comparison/predicate/power/needs_overflow_classification/minimum
data modify storage math:internal w_comparison.predicate.power_needs_overflow_classification.maximum set compute default math:internal/comparison/predicate/power/needs_overflow_classification/maximum
execute if predicate math:internal/power/needs_overflow_classification run return run function math:power/7.boundary_positive
data modify storage math:internal w_comparison.predicate.exp_input_in_range.maximum set compute default math:internal/comparison/predicate/exp/input_in_range/maximum
execute unless predicate math:internal/exp/input_in_range run data remove storage math: ans
execute unless predicate math:internal/exp/input_in_range run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:internal/exp/input_in_range run return fail
function math:.common/exp/0.start
data modify storage math: ans set compute default math:common/input/x
data modify storage math:internal w_comparison.predicate.exp_result_finite.minimum set compute default math:internal/comparison/predicate/exp/result_finite/minimum
data modify storage math:internal w_comparison.predicate.exp_result_finite.maximum set compute default math:internal/comparison/predicate/exp/result_finite/maximum
execute unless predicate math:internal/exp/result_finite run data remove storage math: ans
execute unless predicate math:internal/exp/result_finite run data modify storage math: error set value "result_out_of_range"
execute unless predicate math:internal/exp/result_finite run return fail
return 1
