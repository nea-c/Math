data modify storage math: internal.x set from storage math: internal.y
function math:.common/truncate/0.start
data modify storage math: internal.w_comparison.predicate.power_exponent_integer set compute default float math:.validation/predicate/power/exponent_integer/value
execute unless predicate math:.validation/power/exponent_integer run return 1
function math:pow/5.negative_odd
