function math:.common/log/0.start
data modify storage math:internal x set compute default math:power/positive/00
data modify storage math:internal w_comparison.predicate.power_below_overflow_classification.maximum set compute default math:internal/comparison/predicate/power/below_overflow_classification/maximum
execute unless predicate math:internal/power/below_overflow_classification run return run function math:power/7.boundary_positive
data modify storage math:internal w_comparison.predicate.exp_underflows_to_zero.maximum set compute default math:internal/comparison/predicate/exp/underflows_to_zero/maximum
execute if predicate math:internal/exp/underflows_to_zero run data modify storage math: ans set value 0.0f
execute if predicate math:internal/exp/underflows_to_zero run return 1
execute if data storage math:internal {x:-103.97207641601562f} run data modify storage math: ans set compute default math:exp/minimum/00
execute if data storage math:internal {x:-103.97207641601562f} run return 1
function math:.common/exp/0.start
data modify storage math: ans set compute default math:common/input/x
return 1
