data remove storage math: error
execute unless predicate math:internal/finite/a run data remove storage math: ans
execute unless predicate math:internal/finite/a run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/a run return fail
data modify storage math:internal x set from storage math: a
execute if predicate math:internal/range/negative run data remove storage math: ans
execute if predicate math:internal/range/negative run data modify storage math: error set value "non_real_result"
execute if predicate math:internal/range/negative run return fail
execute if predicate math:internal/log/zero run data remove storage math: ans
execute if predicate math:internal/log/zero run data modify storage math: error set value "non_real_result"
execute if predicate math:internal/log/zero run return fail
function math:internal/log_x
data modify storage math: ans set compute default math:common/input/x
return 1
