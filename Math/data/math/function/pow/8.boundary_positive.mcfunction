data modify storage math: internal.w_comparison.predicate.power_needs_overflow_classification set compute default float math:.validation/predicate/power/needs_overflow_classification/value
execute unless predicate math:.validation/power/needs_overflow_classification run return 1
function math:pow/10.classify_overflow
data modify storage math: internal.w_comparison.predicate.power_classifier_overflow set compute default float math:.validation/predicate/power/classifier_overflow/value
execute if predicate math:.validation/power/classifier_overflow run return 1
data modify storage math: internal.x set compute default float math:pow/classify/evaluation_exponent/00
function math:.common/exp/0.start
data modify storage math: ans set compute default float math:.common/input/x
return 1
